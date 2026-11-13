// supabase/functions/manage-transaction/index.ts
// ویرایش و حذف تراکنش دفتر مستقل کاربر — نسخه ۳.۶
// ============================================================
// PUT    /manage-transaction?id=<txn-uuid>  → ویرایش
// DELETE /manage-transaction?id=<txn-uuid>  → حذف
//
// اعتبارسنجی:
//   - فقط صاحب دفتر (transactions.user_id === auth.uid) می‌تواند
//   - کاربر غیرفعال رد می‌شود
//   - در ویرایش: kind معتبر، مبلغ مثبت صحیح، طرف‌حساب مجاز، دسته شخصی
//     و منطبق با طرف‌حساب (در صورت مخصوص بودن)
//   - در حذف: کامنت‌های تراکنش به‌خاطر FK on delete cascade خودکار حذف می‌شوند
//
// Deploy: supabase functions deploy manage-transaction --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KINDS = [
  "opening_claim",
  "opening_debt",
  "claim",
  "debt",
  "paid_to",
  "received_from",
];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "PUT, DELETE, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "PUT" && req.method !== "DELETE") {
    return json({ error: "متد پشتیبانی نمی‌شود" }, 405);
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (!user) return json({ error: "احراز هویت نشده" }, 401);

    // شناسه تراکنش از query
    const url = new URL(req.url);
    const txnId = url.searchParams.get("id");
    if (!txnId) return json({ error: "شناسه تراکنش الزامی است (?id=...)" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // پروفایل کاربر + بررسی فعال بودن
    const { data: myProfile } = await admin
      .from("user_profiles")
      .select("is_active, display_name, role")
      .eq("id", user.id)
      .maybeSingle();
    if (!myProfile) return json({ error: "پروفایل کاربر یافت نشد" }, 403);
    if (myProfile.is_active === false)
      return json({ error: "حساب شما توسط ادمین غیرفعال شده است" }, 403);

    // تراکنش موجود
    const { data: txn, error: txnErr } = await admin
      .from("transactions")
      .select("*")
      .eq("id", txnId)
      .maybeSingle();
    if (txnErr) return json({ error: txnErr.message }, 500);
    if (!txn) return json({ error: "تراکنش یافت نشد" }, 404);

    // فقط صاحب دفتر می‌تواند
    if (txn.user_id !== user.id)
      return json(
        { error: "شما فقط می‌توانید تراکنش‌های خودتان را ویرایش یا حذف کنید" },
        403
      );

    // ┌──────────────── DELETE ────────────────┐
    if (req.method === "DELETE") {
      // حذف تراکنش؛ کامنت‌ها به‌خاطر cascade خودکار حذف می‌شوند
      const { error: delErr } = await admin
        .from("transactions")
        .delete()
        .eq("id", txnId);
      if (delErr) return json({ error: delErr.message }, 500);

      // گزارش ممیزی
      await admin.from("audit_logs").insert({
        actor_id: user.id,
        actor_name: myProfile.display_name || "—",
        action: "DELETE_TXN",
        entity_type: "Transaction",
        entity_id: txnId,
        result: "success",
        details:
          "حذف تراکنش " + txn.amount + " " + txn.kind + " (effective " + txn.effective_at + ")",
      });

      return json({ ok: true });
    }

    // ┌──────────────── PUT (update) ──────────┐
    const body = await req.json();

    // فیلدهای قابل ویرایش
    const nextKind = body.kind ?? txn.kind;
    const nextCounterpartyId = body.counterpartyId ?? txn.counterparty_id;
    const nextAmount =
      body.amount !== undefined ? Math.floor(Number(body.amount)) : txn.amount;
    const nextCurrency = body.currency ?? txn.currency;
    const nextEffectiveAt = body.effectiveAt ?? txn.effective_at;
    const nextDescription =
      body.description !== undefined ? body.description || null : txn.description;
    const nextCategoryId =
      body.categoryId !== undefined ? body.categoryId || null : txn.category_id;

    // اعتبارسنجی
    if (!KINDS.includes(nextKind))
      return json({ error: "نوع عملیات نامعتبر است" }, 400);
    if (!Number.isFinite(nextAmount) || nextAmount <= 0)
      return json({ error: "مبلغ نامعتبر" }, 400);
    if (!nextCounterpartyId)
      return json({ error: "طرف حساب الزامی است" }, 400);
    if (!nextEffectiveAt) return json({ error: "تاریخ الزامی است" }, 400);

    // طرف حساب جدید باید مجاز باشد (همان منطق create-transaction)
    const { data: cp } = await admin
      .from("counterparties")
      .select("*")
      .eq("id", nextCounterpartyId)
      .maybeSingle();
    if (!cp) return json({ error: "طرف حساب یافت نشد" }, 404);
    if (cp.linked_user_id === user.id)
      return json(
        { error: "نمی‌توان با طرف حساب خودتان تراکنش ثبت کرد" },
        400
      );
    if (cp.is_shared === false) {
      if (cp.owner_user_id !== user.id)
        return json({ error: "این طرف حساب شخصی شما نیست" }, 403);
    } else {
      const isAdmin = myProfile.role === "admin";
      if (!isAdmin) {
        const { count } = await admin
          .from("counterparty_access")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("counterparty_id", nextCounterpartyId);
        if (!count)
          return json(
            { error: "ادمین به شما دسترسی این طرف حساب مشترک را نداده است" },
            403
          );
      }
    }

    // دسته‌بندی باید متعلق به خود کاربر باشد و (در صورت مخصوص بودن) با
    // طرف‌حسابِ همین تراکنش منطبق باشد. دسته‌های «عمومی» با همه قابل استفاده‌اند.
    if (nextCategoryId) {
      const { data: cat } = await admin
        .from("categories")
        .select("id, counterparty_id")
        .eq("id", nextCategoryId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cat) return json({ error: "دسته‌بندی نامعتبر است" }, 400);
      if (cat.counterparty_id && cat.counterparty_id !== nextCounterpartyId) {
        return json(
          { error: "این دسته‌بندی مخصص طرف‌حساب دیگری است و برای این تراکنش قابل استفاده نیست" },
          400
        );
      }
    }

    // به‌روزرسانی
    const { data: updated, error: updErr } = await admin
      .from("transactions")
      .update({
        kind: nextKind,
        counterparty_id: nextCounterpartyId,
        amount: nextAmount,
        currency: nextCurrency,
        effective_at: nextEffectiveAt,
        description: nextDescription,
        category_id: nextCategoryId,
      })
      .eq("id", txnId)
      .select()
      .single();
    if (updErr) return json({ error: updErr.message }, 500);

    // گزارش ممیزی
    const changes = [];
    if (nextKind !== txn.kind) changes.push("نوع");
    if (nextCounterpartyId !== txn.counterparty_id) changes.push("طرف حساب");
    if (nextAmount !== txn.amount) changes.push("مبلغ");
    if (nextEffectiveAt !== txn.effective_at) changes.push("تاریخ");
    if (nextDescription !== (txn.description ?? null)) changes.push("توضیحات");
    if (nextCategoryId !== (txn.category_id ?? null)) changes.push("دسته");

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: myProfile.display_name || "—",
      action: "UPDATE_TXN",
      entity_type: "Transaction",
      entity_id: txnId,
      result: "success",
      details:
        "ویرایش تراکنش " +
        txn.amount +
        " " +
        txn.kind +
        (changes.length ? " — تغییر: " + changes.join("، ") : ""),
    });

    return json({ ok: true, transaction: updated });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// supabase/functions/create-transaction/index.ts
// ثبت تراکنش در دفتر مستقل کاربر — نسخه ۳.۰ (تطابق حذف شد)
// شش kind: opening_claim / opening_debt / claim / debt / paid_to / received_from
// Deploy: supabase functions deploy create-transaction

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
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "احراز هویت نشده" }, 401);

    const body = await req.json();
    const kind = body.kind;
    const counterpartyId = body.counterpartyId;
    const amount = Math.floor(Number(body.amount));
    const currency = body.currency || "IRT";
    const effectiveAt = body.effectiveAt; // شمسی yyyy-mm-dd
    const description = body.description || null;
    const categoryId = body.categoryId || null;
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();

    // اعتبارسنجی
    if (!counterpartyId) return json({ error: "طرف حساب الزامی است" }, 400);
    if (!KINDS.includes(kind)) return json({ error: "نوع عملیات نامعتبر است" }, 400);
    if (!Number.isFinite(amount) || amount <= 0)
      return json({ error: "مبلغ نامعتبر" }, 400);
    if (!effectiveAt) return json({ error: "تاریخ الزامی است" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // کاربر غیرفعال نمی‌تواند ثبت کند
    const { data: myProfile } = await admin
      .from("user_profiles").select("is_active, display_name").eq("id", user.id).maybeSingle();
    if (!myProfile) return json({ error: "پروفایل کاربر یافت نشد" }, 403);
    if (myProfile.is_active === false)
      return json({ error: "حساب شما توسط ادمین غیرفعال شده است" }, 403);

    // طرف حساب
    const { data: cp } = await admin
      .from("counterparties").select("*").eq("id", counterpartyId).maybeSingle();
    if (!cp) return json({ error: "طرف حساب یافت نشد" }, 404);
    if (cp.linked_user_id === user.id)
      return json({ error: "نمی‌توان با طرف حساب خودتان تراکنش ثبت کنید" }, 400);

    // دسترسی به طرف حساب:
    //   شخصی → فقط مالکش | مشترک → ادمین یا داشتن گرنت
    if (cp.is_shared === false) {
      if (cp.owner_user_id !== user.id)
        return json({ error: "این طرف حساب شخصی شما نیست" }, 403);
    } else {
      const isAdmin = myProfile.is_active && (await admin
        .from("user_profiles").select("role").eq("id", user.id).maybeSingle()
      ).data?.role === "admin";
      if (!isAdmin) {
        const { count } = await admin
          .from("counterparty_access")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("counterparty_id", counterpartyId);
        if (!count)
          return json(
            { error: "ادمین به شما دسترسی این طرف حساب مشترک را نداده است" },
            403
          );
      }
    }

    // دسته‌بندی باید متعلق به خود کاربر باشد و (در صورت مخصوص بودن) با
    // طرف‌حسابِ همین تراکنش منطبق باشد. دسته‌های «عمومی» (counterparty_id=null)
    // با همه طرف‌حساب‌ها قابل استفاده‌اند.
    if (categoryId) {
      const { data: cat } = await admin
        .from("categories").select("id, counterparty_id").eq("id", categoryId)
        .eq("user_id", user.id).maybeSingle();
      if (!cat) return json({ error: "دسته‌بندی نامعتبر است" }, 400);
      if (cat.counterparty_id && cat.counterparty_id !== counterpartyId) {
        return json(
          { error: "این دسته‌بندی مخصص طرف‌حساب دیگری است و برای این تراکنش قابل استفاده نیست" },
          400
        );
      }
    }

    // idempotency: اگر تراکنش با همین کلید قبلاً ثبت شده، همان را برگردان
    const { data: existing } = await admin
      .from("transactions").select("*")
      .eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return json({ ok: true, transaction: existing, idempotent: true });

    // درج تراکنش — دفتر مستقل، بدون تطابق
    const { data: txn, error } = await admin.from("transactions").insert({
      user_id: user.id,
      counterparty_id: counterpartyId,
      kind,
      amount,
      currency,
      effective_at: effectiveAt,
      created_by: user.id,
      description,
      category_id: categoryId,
      status: "POSTED",
      idempotency_key: idempotencyKey,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    // گزارش ممیزی
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: myProfile.display_name || "—",
      action: "CREATE_TXN",
      entity_type: "Transaction",
      entity_id: txn.id,
      result: "success",
      details: "ثبت " + amount + " " + kind + (categoryId ? " — دسته‌بندی‌دار" : ""),
    });

    return json({ ok: true, transaction: txn });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

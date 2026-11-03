// supabase/functions/create-transaction/index.ts
// ثبت تراکنش با منطق تطابق خودکار بین‌کاربری
// Deploy: supabase functions deploy create-transaction

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const direction = body.direction;
    const counterpartyId = body.counterpartyId;
    const amount = Math.floor(Number(body.amount));
    const currency = body.currency || "IRT";
    const effectiveAt = body.effectiveAt; // شمسی yyyy-mm-dd
    const description = body.description || null;
    const idempotencyKey = body.idempotencyKey || crypto.randomUUID();

    // اعتبارسنجی
    if (!counterpartyId) return json({ error: "طرف حساب الزامی است" }, 400);
    if (!["received_from", "paid_to"].includes(direction))
      return json({ error: "نوع عملیات نامعتبر" }, 400);
    if (!Number.isFinite(amount) || amount <= 0)
      return json({ error: "مبلغ نامعتبر" }, 400);
    if (!effectiveAt) return json({ error: "تاریخ الزامی است" }, 400);

    // کلاینت service_role برای نوشتن (RLS نوشتن را ممنوع کرده)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );

    // طرف حساب
    const { data: cp } = await admin
      .from("counterparties").select("*").eq("id", counterpartyId).maybeSingle();
    if (!cp) return json({ error: "طرف حساب یافت نشد" }, 404);
    if (cp.linked_user_id === user.id)
      return json({ error: "نمی‌توان با طرف حساب خودتان تراکنش ثبت کنید" }, 400);

    // idempotency: اگر تراکنش با همین کلید قبلاً ثبت شده، همان را برگردان
    const { data: existing } = await admin
      .from("transactions").select("*")
      .eq("user_id", user.id).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing) return json({ ok: true, transaction: existing, idempotent: true });

    // درج تراکنش
    const { data: txn, error } = await admin.from("transactions").insert({
      user_id: user.id,
      counterparty_id: counterpartyId,
      direction,
      amount,
      currency,
      effective_at: effectiveAt,
      created_by: user.id,
      description,
      status: "POSTED",
      match_status: "pending",
      idempotency_key: idempotencyKey,
    }).select().single();
    if (error) return json({ error: error.message }, 500);

    // --- منطق تطابق بین‌کاربری ---
    // اگر طرف حساب به کاربری لینک است، در دفتر آن کاربر به دنبال تراکنش
    // تطبیقی می‌گردیم: جهت متضاد، مبلغ/تاریخ/واحد برابر، و طرف حسابِ آن
    // تراکنش به کاربرِ فعلی لینک باشد (لینک متقابل).
    let matchedWith = null;
    let matchStatus = "unmatched";

    if (cp.linked_user_id) {
      // طرف حسابی که نماینده کاربر فعلی است (در دفتر طرف مقابل)
      const { data: partnerCp } = await admin
        .from("counterparties").select("*")
        .eq("linked_user_id", user.id).maybeSingle();

      if (partnerCp) {
        // تراکنش‌های کاربر لینک‌شده به این طرف حساب
        const { data: candidates } = await admin
          .from("transactions").select("*")
          .eq("user_id", cp.linked_user_id)
          .eq("status", "POSTED");

        for (const c of candidates || []) {
          // باید طرف حسابِ تراکنشِ مقابل، همان partnerCp باشد (لینک متقابل)
          if (c.counterparty_id !== partnerCp.id) continue;
          if (c.direction === direction) continue; // باید متضاد
          if (c.amount !== amount) continue;
          if (c.currency !== currency) continue;
          if (c.effective_at !== effectiveAt) continue;
          matchedWith = c;
          break;
        }
      }
      matchStatus = matchedWith ? "matched" : "pending";
    }

    // به‌روزرسانی وضعیت تطابق (در خود تراکنش و در زوج)
    if (matchedWith) {
      await admin.from("transactions").update({
        match_status: "matched",
        matched_transaction_id: matchedWith.id,
      }).eq("id", txn.id);
      await admin.from("transactions").update({
        match_status: "matched",
        matched_transaction_id: txn.id,
      }).eq("id", matchedWith.id);
    } else if (!cp.linked_user_id) {
      await admin.from("transactions").update({
        match_status: "unmatched",
        matched_transaction_id: null,
      }).eq("id", txn.id);
    }

    // گزارش ممیزی
    const { data: profile } = await admin
      .from("user_profiles").select("display_name").eq("id", user.id).maybeSingle();
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      actor_name: profile?.display_name || "—",
      action: "CREATE_TXN",
      entity_type: "Transaction",
      entity_id: txn.id,
      result: "success",
      details: "ثبت " + amount + " " + direction + " — " + matchStatus,
    });

    const updatedTxn = (await admin
      .from("transactions").select("*").eq("id", txn.id).maybeSingle()).data;

    return json({
      ok: true,
      transaction: updatedTxn,
      matchedWith,
      matchStatus,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

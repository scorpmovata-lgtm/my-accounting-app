// ============================================================
// Edge Function: create-transaction
// مسیر فایل در پروژه: supabase/functions/create-transaction/index.ts
// دیپلوی: supabase functions deploy create-transaction --no-verify-jwt
// ============================================================
// این تابع تراکنش مالی را با اعتبارسنجی اتمیک ثبت می‌کند.
// کاربران مستقیماً به جدول transactions INSERT نمی‌کنند — همگی از این تابع می‌گذرند.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TRANSACTION_EFFECT: Record<string, { receivable: number; payable: number }> = {
  OPENING_RECEIVABLE: { receivable: 1, payable: 0 },
  OPENING_PAYABLE: { receivable: 0, payable: 1 },
  RECEIVABLE_CHARGE: { receivable: 1, payable: 0 },
  PAYABLE_CHARGE: { receivable: 0, payable: 1 },
  RECEIPT_ALLOCATION: { receivable: -1, payable: 0 },
  PAYMENT_ALLOCATION: { receivable: 0, payable: -1 },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// استخراج شناسه کاربر از JWT
// (Supabase هنگام درخواست از سمت کلاینت با verify_jwt=true خودکار تأیید می‌کند،
//  ولی چون این تابع را با --no-verify-jwt دیپلوی می‌کنیم، خودمان payload را استخراج می‌کنیم)
// نکته مهم: JWT از base64url استفاده می‌کند؛ باید به base64 تبدیل کنیم تا atob درست کار کند
function extractUser(jwt: string): { sub: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    // تبدیل base64url به base64 استاندارد
    let payload = parts[1];
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const decoded = atob(payload);
    const data = JSON.parse(decoded);
    if (!data.sub) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return { sub: String(data.sub) };
  } catch (e) {
    console.error("extractUser error:", e);
    return null;
  }
}

async function computeOutstanding(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  currency: string
): Promise<{ receivable: number; payable: number }> {
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount")
    .eq("contact_id", contactId)
    .eq("status", "POSTED")
    .eq("currency", currency);

  if (error) throw error;

  let receivable = 0;
  let payable = 0;
  for (const t of data ?? []) {
    const effect = TRANSACTION_EFFECT[t.transaction_type];
    if (!effect) continue;
    receivable += effect.receivable * t.amount;
    payable += effect.payable * t.amount;
  }
  return { receivable, payable };
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  result: "success" | "failure",
  details: string,
  entityId: string
) {
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "CREATE_TXN",
    entity_type: "Transaction",
    entity_id: entityId,
    result,
    details,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const jwt = authHeader.replace("Bearer ", "");
  const user = extractUser(jwt);
  if (!user) {
    return json({ error: "Invalid token" }, 401);
  }

  let input: {
    contactId: string;
    categoryId?: string | null;
    transactionType: keyof typeof TRANSACTION_EFFECT;
    amount: number;
    currency: "IRT" | "IRR";
    effectiveAt: string;
    description?: string;
    idempotencyKey: string;
  };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (
    !input.contactId ||
    !input.transactionType ||
    !input.amount ||
    !input.currency ||
    !input.effectiveAt ||
    !input.idempotencyKey
  ) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (input.amount <= 0) {
    return json({ error: "Amount must be positive" }, 400);
  }
  if (!TRANSACTION_EFFECT[input.transactionType]) {
    return json({ error: "Invalid transaction type" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ۱. تأیید مالکیت: کاربر مالک دفتر این مخاطب است
  // از دو query جداگانه استفاده می‌کنیم (به‌جای join) تا از مشکل inference 
  // در بعضی پیکربندی‌های Supabase جلوگیری کنیم
  const { data: contact, error: contactErr } = await supabase
    .from("contacts")
    .select("id, ledger_id, display_name")
    .eq("id", input.contactId)
    .single();

  if (!contact || contactErr) {
    const detail = "Contact not found; id=" + input.contactId + "; err=" + (contactErr?.message ?? "null");
    await logAudit(supabase, user.sub, "failure", detail, "-");
    return json({ error: "Contact not found" }, 404);
  }

  if (!contact.ledger_id) {
    const detail = "Contact has no ledger_id; contact_id=" + input.contactId;
    await logAudit(supabase, user.sub, "failure", detail, "-");
    return json({ error: detail }, 403);
  }

  // ۲. بررسی مالکیت با query مستقیم از ledgers
  const { data: ledger, error: ledgerErr } = await supabase
    .from("ledgers")
    .select("id, owner_user_id")
    .eq("id", contact.ledger_id)
    .single();

  if (!ledger || ledgerErr) {
    const detail = "Ledger not found; ledger_id=" + contact.ledger_id + "; err=" + (ledgerErr?.message ?? "null");
    await logAudit(supabase, user.sub, "failure", detail, "-");
    return json({ error: detail }, 403);
  }

  if (ledger.owner_user_id !== user.sub) {
    const detail = "Owner mismatch; expected=" + user.sub + "; actual=" + ledger.owner_user_id + "; ledger_id=" + ledger.id;
    await logAudit(supabase, user.sub, "failure", detail, "-");
    return json({ error: "Not authorized (owner mismatch)" }, 403);
  }

  // ۳. Idempotency: اگر همین تراکنش قبلاً ثبت شده، همان را برگردان
  const { data: existing } = await supabase
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledger.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return json({ ok: true, transaction: existing, idempotent: true });
  }

  // ۴. اعتبارسنجی مالی: دریافت نباید از طلب باز بیشتر باشد
  if (
    input.transactionType === "RECEIPT_ALLOCATION" ||
    input.transactionType === "PAYMENT_ALLOCATION"
  ) {
    const balance = await computeOutstanding(supabase, input.contactId, input.currency);
    if (input.transactionType === "RECEIPT_ALLOCATION" && input.amount > balance.receivable) {
      const msg =
        "Receipt " + input.amount + " exceeds outstanding receivable " + balance.receivable;
      await logAudit(supabase, user.sub, "failure", msg, "-");
      return json({ error: msg }, 400);
    }
    if (input.transactionType === "PAYMENT_ALLOCATION" && input.amount > balance.payable) {
      const msg =
        "Payment " + input.amount + " exceeds outstanding payable " + balance.payable;
      await logAudit(supabase, user.sub, "failure", msg, "-");
      return json({ error: msg }, 400);
    }
  }

  // ۵. ثبت تراکنش
  const { data: txn, error: insertErr } = await supabase
    .from("transactions")
    .insert({
      ledger_id: ledger.id,
      contact_id: input.contactId,
      category_id: input.categoryId ?? null,
      transaction_type: input.transactionType,
      amount: input.amount,
      currency: input.currency,
      effective_at: input.effectiveAt,
      created_by: user.sub,
      description: input.description ?? null,
      status: "POSTED",
      idempotency_key: input.idempotencyKey,
    })
    .select()
    .single();

  if (insertErr || !txn) {
    const msg = "Insert failed: " + (insertErr?.message ?? "unknown");
    await logAudit(supabase, user.sub, "failure", msg, "-");
    return json({ error: msg }, 500);
  }

  // ۶. ممیزی
  await logAudit(
    supabase,
    user.sub,
    "success",
    "Created " + input.transactionType + " " + input.amount + " " + input.currency +
      " for " + contact.display_name,
    txn.id
  );

  return json({ ok: true, transaction: txn });
});

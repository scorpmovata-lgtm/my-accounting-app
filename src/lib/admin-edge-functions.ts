// Edge Function‌های ادمین — در فایل جداگانه برای پایداری
// این فایل نباید با deployment-artifacts.ts ترکیب شود

export const SEED_DATA_SQL = `-- ============================================================
-- داده موک برای تست ربات تلگرام
-- اجرا در: Supabase -> SQL Editor -> New query -> Paste -> Run
-- پیش‌نیاز: حداقل یک کاربر در Authentication -> Users ساخته باشی
-- ============================================================

-- 1. ساخت مخاطب "رضا کریمی" در دفتر اول کاربر
INSERT INTO public.contacts (ledger_id, display_name, notes)
SELECT id, 'رضا کریمی', 'فروشنده کالا — داده موک برای تست ربات'
FROM public.ledgers
WHERE archived_at IS NULL
LIMIT 1;

-- 2. تراکنش 1: ایجاد طلب 5,000,000 تومان
INSERT INTO public.transactions (
  ledger_id, contact_id, transaction_type, amount, currency,
  effective_at, created_by, description, status, idempotency_key
)
SELECT
  c.ledger_id, c.id, 'RECEIVABLE_CHARGE', 5000000, 'IRT',
  '2024-01-15', l.owner_user_id, 'فروش کالا به رضا — داده موک', 'POSTED', 'seed-txn-1'
FROM public.contacts c
JOIN public.ledgers l ON l.id = c.ledger_id
WHERE c.display_name = 'رضا کریمی'
ON CONFLICT (ledger_id, idempotency_key) DO NOTHING;

-- 3. تراکنش 2: دریافت 2,000,000 تومان
INSERT INTO public.transactions (
  ledger_id, contact_id, transaction_type, amount, currency,
  effective_at, created_by, description, status, idempotency_key
)
SELECT
  c.ledger_id, c.id, 'RECEIPT_ALLOCATION', 2000000, 'IRT',
  '2024-01-25', l.owner_user_id, 'دریافت بخشی از طلب — داده موک', 'POSTED', 'seed-txn-2'
FROM public.contacts c
JOIN public.ledgers l ON l.id = c.ledger_id
WHERE c.display_name = 'رضا کریمی'
ON CONFLICT (ledger_id, idempotency_key) DO NOTHING;

-- 4. ساخت کد اتصال با مقدار 482319
INSERT INTO public.link_codes (code, contact_id, ledger_id, scope, expires_at)
SELECT '482319', c.id, c.ledger_id, 'balance_only', NOW() + INTERVAL '1 hour'
FROM public.contacts c
WHERE c.display_name = 'رضا کریمی'
ON CONFLICT (code) DO UPDATE
SET expires_at = NOW() + INTERVAL '1 hour',
    used = false,
    used_at = NULL;

-- 5. نمایش نتیجه
SELECT 'مخاطب' AS entity, id, display_name FROM public.contacts WHERE display_name = 'رضا کریمی';
SELECT 'تراکنش‌ها' AS entity, count(*)::text AS count FROM public.transactions
  WHERE contact_id IN (SELECT id FROM public.contacts WHERE display_name = 'رضا کریمی');
SELECT 'کد اتصال' AS entity, code, expires_at, used FROM public.link_codes WHERE code = '482319';
`;

export const ADMIN_USERS_FN = `// Edge Function: admin-users
// مدیریت کاربران — فقط admin (صاحب دفتر) می‌تواند استفاده کند
// مسیر: supabase/functions/admin-users/index.ts
// دیپلوی: supabase functions deploy admin-users --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUser(jwt: string): { sub: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const data = JSON.parse(atob(payload));
    if (!data.sub) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return { sub: String(data.sub) };
  } catch (e) {
    console.error("extractUser error:", e);
    return null;
  }
}

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return data !== null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const isAdmin = await checkAdmin(supabase, user.sub);
  if (!isAdmin) {
    return json({ error: "Forbidden - admin only" }, 403);
  }

  // GET: لیست همه کاربران
  if (req.method === "GET") {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return json({ error: error.message }, 500);
    }
    const users = (data.users ?? []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed: u.email_confirmed_at != null,
      display_name: u.user_metadata?.display_name ?? null,
    }));
    return json({ users });
  }

  // POST: ساخت کاربر جدید
  if (req.method === "POST") {
    let input: { email: string; password: string; display_name?: string };
    try {
      input = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!input.email || !input.password) {
      return json({ error: "email and password required" }, 400);
    }
    if (input.password.length < 6) {
      return json({ error: "password must be at least 6 characters" }, 400);
    }
    const { data, error } = await supabase.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { display_name: input.display_name ?? input.email },
    });
    if (error) {
      return json({ error: error.message }, 400);
    }
    await supabase.from("audit_logs").insert({
      actor_id: user.sub,
      action: "ADMIN_CREATE_USER",
      entity_type: "User",
      entity_id: data.user.id,
      result: "success",
      details: "Created user " + input.email,
    });
    return json({
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        display_name: input.display_name ?? input.email,
      },
    });
  }

  // DELETE: حذف کاربر
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("id");
    if (!userId) {
      return json({ error: "id query param required" }, 400);
    }
    if (userId === user.sub) {
      return json({ error: "Cannot delete yourself" }, 400);
    }
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      return json({ error: error.message }, 400);
    }
    await supabase.from("audit_logs").insert({
      actor_id: user.sub,
      action: "ADMIN_DELETE_USER",
      entity_type: "User",
      entity_id: userId,
      result: "success",
      details: "Deleted user " + userId,
    });
    return json({ ok: true });
  }

  // PUT: به‌روزرسانی display_name کاربر
  if (req.method === "PUT") {
    const url = new URL(req.url);
    const userId = url.searchParams.get("id");
    if (!userId) {
      return json({ error: "id query param required" }, 400);
    }
    let input: { display_name?: string };
    try {
      input = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!input.display_name || !input.display_name.trim()) {
      return json({ error: "display_name required" }, 400);
    }
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { display_name: input.display_name.trim() },
    });
    if (error) {
      return json({ error: error.message }, 400);
    }
    await supabase.from("audit_logs").insert({
      actor_id: user.sub,
      action: "ADMIN_UPDATE_USER",
      entity_type: "User",
      entity_id: userId,
      result: "success",
      details: "Updated display_name for user " + userId,
    });
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
});
`;

export const ADMIN_BACKUP_FN = `// Edge Function: admin-backup
// export همه جداول به JSON — فقط admin
// مسیر: supabase/functions/admin-backup/index.ts
// دیپلوی: supabase functions deploy admin-backup --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUser(jwt: string): { sub: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const data = JSON.parse(atob(payload));
    if (!data.sub) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return { sub: String(data.sub) };
  } catch (e) {
    console.error("extractUser error:", e);
    return null;
  }
}

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return data !== null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }
  const jwt = authHeader.replace("Bearer ", "");
  const user = extractUser(jwt);
  if (!user) return json({ error: "Invalid token" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const isAdmin = await checkAdmin(supabase, user.sub);
  if (!isAdmin) return json({ error: "Forbidden - admin only" }, 403);

  const { data: ledgers } = await supabase
    .from("ledgers")
    .select("*")
    .eq("owner_user_id", user.sub);
  const ledgerIds = (ledgers ?? []).map((l: any) => l.id);

  if (ledgerIds.length === 0) {
    return json({ error: "No ledgers found for this user" }, 404);
  }

  const [contacts, categories, transactions, auditLogs, telegramLinks, linkCodes, profiles] = await Promise.all([
    supabase.from("contacts").select("*").in("ledger_id", ledgerIds),
    supabase.from("categories").select("*").in("ledger_id", ledgerIds),
    supabase.from("transactions").select("*").in("ledger_id", ledgerIds),
    supabase.from("audit_logs").select("*").eq("actor_id", user.sub).order("created_at", { ascending: false }).limit(1000),
    supabase.from("telegram_links").select("*").in("ledger_id", ledgerIds),
    supabase.from("link_codes").select("*").in("ledger_id", ledgerIds),
    supabase.from("profiles").select("*").eq("id", user.sub),
  ]);

  const backup = {
    version: "1.0",
    created_at: new Date().toISOString(),
    admin_user_id: user.sub,
    ledgers: ledgers ?? [],
    profiles: profiles.data ?? [],
    contacts: contacts.data ?? [],
    categories: categories.data ?? [],
    transactions: transactions.data ?? [],
    audit_logs: auditLogs.data ?? [],
    telegram_links: telegramLinks.data ?? [],
    link_codes: linkCodes.data ?? [],
  };

  await supabase.from("audit_logs").insert({
    actor_id: user.sub,
    action: "ADMIN_BACKUP",
    entity_type: "Database",
    entity_id: "-",
    result: "success",
    details: "Exported backup with " + (transactions.data?.length ?? 0) + " transactions",
  });

  return json(backup);
});
`;

export const ADMIN_RESTORE_FN = `// Edge Function: admin-restore
// import داده‌ها از JSON backup — فقط admin
// مسیر: supabase/functions/admin-restore/index.ts
// دیپلوی: supabase functions deploy admin-restore --no-verify-jwt
// توجه: این عملیات رکوردهای موجود را با همان ID جایگزین می‌کند (upsert)
// ولی رکوردهایی که در backup نیستند را پاک نمی‌کند

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractUser(jwt: string): { sub: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    let payload = parts[1];
    payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    const data = JSON.parse(atob(payload));
    if (!data.sub) return null;
    if (data.exp && data.exp < Date.now() / 1000) return null;
    return { sub: String(data.sub) };
  } catch (e) {
    console.error("extractUser error:", e);
    return null;
  }
}

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  return data !== null;
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
  if (!user) return json({ error: "Invalid token" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const isAdmin = await checkAdmin(supabase, user.sub);
  if (!isAdmin) return json({ error: "Forbidden - admin only" }, 403);

  let backup: any;
  try {
    backup = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!backup || !backup.ledgers) {
    return json({ error: "Invalid backup format - missing ledgers" }, 400);
  }

  const stats = { contacts: 0, categories: 0, transactions: 0, telegram_links: 0, link_codes: 0 };

  const validLedgerIds: string[] = [];
  for (const l of backup.ledgers) {
    if (l.owner_user_id === user.sub) {
      validLedgerIds.push(l.id);
      await supabase.from("ledgers").upsert(l);
    }
  }

  if (validLedgerIds.length === 0) {
    return json({ error: "No valid ledgers in backup for this admin" }, 400);
  }

  if (Array.isArray(backup.contacts)) {
    const validContacts = backup.contacts.filter((c: any) => validLedgerIds.includes(c.ledger_id));
    if (validContacts.length > 0) {
      const { error } = await supabase.from("contacts").upsert(validContacts);
      if (!error) stats.contacts = validContacts.length;
    }
  }
  if (Array.isArray(backup.categories)) {
    const valid = backup.categories.filter((c: any) => validLedgerIds.includes(c.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("categories").upsert(valid);
      if (!error) stats.categories = valid.length;
    }
  }
  if (Array.isArray(backup.transactions)) {
    const valid = backup.transactions.filter((t: any) => validLedgerIds.includes(t.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("transactions").upsert(valid);
      if (!error) stats.transactions = valid.length;
    }
  }
  if (Array.isArray(backup.telegram_links)) {
    const valid = backup.telegram_links.filter((t: any) => validLedgerIds.includes(t.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("telegram_links").upsert(valid);
      if (!error) stats.telegram_links = valid.length;
    }
  }
  if (Array.isArray(backup.link_codes)) {
    const valid = backup.link_codes.filter((l: any) => validLedgerIds.includes(l.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("link_codes").upsert(valid);
      if (!error) stats.link_codes = valid.length;
    }
  }

  await supabase.from("audit_logs").insert({
    actor_id: user.sub,
    action: "ADMIN_RESTORE",
    entity_type: "Database",
    entity_id: "-",
    result: "success",
    details: "Restored: " + JSON.stringify(stats),
  });

  return json({ ok: true, stats });
});
`;

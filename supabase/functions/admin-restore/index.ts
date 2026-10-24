// Edge Function: admin-restore
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

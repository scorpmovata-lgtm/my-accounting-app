// Edge Function: admin-backup
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

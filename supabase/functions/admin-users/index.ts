// Edge Function: admin-users
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

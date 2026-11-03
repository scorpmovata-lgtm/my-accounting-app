// supabase/functions/admin-counterparties/index.ts
// مدیریت طرف حساب‌ها توسط ادمین: GET / POST / PUT / DELETE
// Deploy: supabase functions deploy admin-counterparties

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

async function requireAdmin(req) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_ANON_KEY"),
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return { error: json({ error: "احراز هویت نشده" }, 401) };
  const admin = createClient(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
  const { data: prof } = await admin
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || prof.role !== "admin")
    return { error: json({ error: "فقط ادمین دسترسی دارد" }, 403) };
  return { user, admin };
}

// بازمحاسبه وضعیت تطابق همه تراکنش‌ها (پس از تغییر لینک طرف حساب‌ها)
async function recomputeMatches(admin) {
  const { data: txns } = await admin.from("transactions").select("*").eq("status", "POSTED");
  const { data: cps } = await admin.from("counterparties").select("*");
  const cpMap = new Map((cps || []).map((c) => [c.id, c]));
  for (const t of txns || []) {
    const cp = cpMap.get(t.counterparty_id);
    let status = "unmatched";
    let matchedId = null;
    if (cp && cp.linked_user_id) {
      const partnerCp = (cps || []).find((c) => c.linked_user_id === t.user_id);
      if (partnerCp) {
        for (const o of txns) {
          if (o.id === t.id) continue;
          if (o.user_id !== cp.linked_user_id) continue;
          if (o.counterparty_id !== partnerCp.id) continue;
          if (o.direction === t.direction) continue;
          if (o.amount !== t.amount || o.currency !== t.currency) continue;
          if (o.effective_at !== t.effective_at) continue;
          matchedId = o.id;
          break;
        }
      }
      status = matchedId ? "matched" : "pending";
    }
    await admin.from("transactions").update({
      match_status: status,
      matched_transaction_id: matchedId,
    }).eq("id", t.id);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { user: actor, admin } = auth;

  if (req.method === "GET") {
    const { data, error } = await admin.from("counterparties").select("*").order("created_at");
    if (error) return json({ error: error.message }, 500);
    return json({ counterparties: data });
  }

  if (req.method === "POST") {
    const b = await req.json();
    const displayName = (b.displayName || "").trim();
    if (!displayName) return json({ error: "نام الزامی" }, 400);
    let linkedUsername = null;
    if (b.linkedUserId) {
      const { data: lu } = await admin
        .from("user_profiles").select("username").eq("id", b.linkedUserId).maybeSingle();
      if (!lu) return json({ error: "کاربر لینک‌شده یافت نشد" }, 400);
      const { data: dup } = await admin
        .from("counterparties").select("id").eq("linked_user_id", b.linkedUserId).maybeSingle();
      if (dup) return json({ error: "کاربر قبلاً به طرف حساب دیگری لینک شده" }, 400);
      linkedUsername = lu.username;
    }
    const { data: cp, error } = await admin.from("counterparties").insert({
      display_name: displayName,
      notes: b.notes || null,
      linked_user_id: b.linkedUserId || null,
      linked_username: linkedUsername,
      created_by: actor.id,
    }).select().single();
    if (error) return json({ error: error.message }, 500);
    // sync: اگر لینک شد، linked_counterparty_id کاربر را هم set کن
    if (b.linkedUserId) {
      await admin.from("user_profiles").update({ linked_counterparty_id: cp.id })
        .eq("id", b.linkedUserId);
    }
    return json({ ok: true, counterparty: cp });
  }

  if (req.method === "PUT") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    const b = await req.json();
    const patch = {};
    if (b.displayName) patch.display_name = b.displayName.trim();
    if (b.notes !== undefined) patch.notes = b.notes || null;
    if (b.linkedUserId !== undefined) {
      if (b.linkedUserId) {
        const { data: lu } = await admin
          .from("user_profiles").select("username").eq("id", b.linkedUserId).maybeSingle();
        if (!lu) return json({ error: "کاربر یافت نشد" }, 400);
        const { data: dup } = await admin
          .from("counterparties").select("id").neq("id", id).eq("linked_user_id", b.linkedUserId).maybeSingle();
        if (dup) return json({ error: "کاربر قبلاً لینک شده" }, 400);
        patch.linked_user_id = b.linkedUserId;
        patch.linked_username = lu.username;
      } else {
        patch.linked_user_id = null;
        patch.linked_username = null;
      }
    }
    const { error } = await admin.from("counterparties").update(patch).eq("id", id);
    if (error) return json({ error: error.message }, 500);
    // sync user_profiles
    const { data: cp } = await admin.from("counterparties").select("linked_user_id").eq("id", id).maybeSingle();
    if (cp?.linked_user_id) {
      await admin.from("user_profiles").update({ linked_counterparty_id: id }).eq("id", cp.linked_user_id);
    }
    await recomputeMatches(admin);
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    const { count } = await admin.from("transactions").select("*", { count: "exact", head: true }).eq("counterparty_id", id);
    if (count && count > 0) return json({ error: "طرف حساب تراکنش دارد و قابل حذف نیست" }, 400);
    await admin.from("counterparties").delete().eq("id", id);
    return json({ ok: true });
  }

  return json({ error: "متد پشتیبانی نمی‌شود" }, 405);
});

// supabase/functions/admin-users/index.ts
// مدیریت کاربران توسط ادمین: GET (لیست) / POST (ایجاد) / PUT (ویرایش + فعال/غیرفعال) / DELETE (حذف)
// نسخه ۳.۰ — ستون is_active اضافه شد
// Deploy: supabase functions deploy admin-users

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

async function actorName(admin, id) {
  const { data } = await admin.from("user_profiles").select("display_name").eq("id", id).maybeSingle();
  return data?.display_name || "—";
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
    .from("user_profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!prof || prof.role !== "admin")
    return { error: json({ error: "فقط ادمین دسترسی دارد" }, 403) };
  if (prof.is_active === false)
    return { error: json({ error: "حساب ادمین شما غیرفعال شده است" }, 403) };
  return { user, admin };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = await requireAdmin(req);
  if (auth.error) return auth.error;
  const { user: actor, admin } = auth;

  // GET → لیست کاربران
  if (req.method === "GET") {
    const { data, error } = await admin.from("user_profiles").select("*").order("created_at");
    if (error) return json({ error: error.message }, 500);
    return json({ users: data });
  }

  // POST → ایجاد کاربر
  if (req.method === "POST") {
    const b = await req.json();
    const username = (b.username || "").trim().toLowerCase();
    const password = b.password;
    const displayName = (b.displayName || "").trim();
    const role = b.role || "user";
    const scope = b.scope || null;
    const makeCounterparty = b.makeCounterparty !== false;

    if (!username || username.length < 3)
      return json({ error: "نام کاربری حداقل ۳ نویسه" }, 400);
    if (!password || password.length < 4)
      return json({ error: "رمز حداقل ۴ نویسه" }, 400);
    if (!displayName) return json({ error: "نام نمایشی الزامی" }, 400);
    if (role === "user" && !scope)
      return json({ error: "سطح دسترسی برای کاربر عادی الزامی" }, 400);

    // یکتایی username
    const { data: dup } = await admin
      .from("user_profiles").select("id").eq("username", username).maybeSingle();
    if (dup) return json({ error: "نام کاربری قبلاً گرفته شده" }, 400);

    // ساخت کاربر در auth.users با email ساختگی
    const email = username + "@accounting.local";
    const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) return json({ error: authErr.message }, 500);

    // درج پروفایل (is_active پیش‌فرض true)
    const { error: profErr } = await admin.from("user_profiles").insert({
      id: newUser.user.id,
      username,
      display_name: displayName,
      role,
      scope: role === "user" ? scope : null,
    });
    if (profErr) return json({ error: profErr.message }, 500);

    // ایجاد طرف حساب هم‌نام (مشترک) و لینک (اگر خواسته شده)
    if (makeCounterparty) {
      const { data: cp } = await admin.from("counterparties").insert({
        display_name: displayName,
        linked_user_id: newUser.user.id,
        linked_username: username,
        is_shared: true,
        created_by: actor.id,
      }).select().single();
      if (cp) {
        await admin.from("user_profiles").update({ linked_counterparty_id: cp.id })
          .eq("id", newUser.user.id);
      }
    }

    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_name: await actorName(admin, actor.id),
      action: "ADD_USER",
      entity_type: "User",
      entity_id: newUser.user.id,
      result: "success",
      details: "افزودن کاربر " + displayName + " (" + username + ")",
    });
    return json({ ok: true, userId: newUser.user.id });
  }

  // PUT → ویرایش (نام/سطح/رمز + فعال/غیرفعال)
  if (req.method === "PUT") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    const b = await req.json();
    const patch = {};
    if (b.displayName) patch.display_name = b.displayName.trim();
    if (b.scope) patch.scope = b.scope;
    if (b.isActive !== undefined) patch.is_active = !!b.isActive;
    if (Object.keys(patch).length) {
      const { error } = await admin.from("user_profiles").update(patch).eq("id", id);
      if (error) return json({ error: error.message }, 500);
    }
    if (b.password) {
      const { error: pwErr } = await admin.auth.admin.updateUserById(id, { password: b.password });
      if (pwErr) return json({ error: pwErr.message }, 500);
    }
    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_name: await actorName(admin, actor.id),
      action: "UPDATE_USER",
      entity_type: "User",
      entity_id: id,
      result: "success",
      details:
        "ویرایش کاربر" +
        (b.isActive !== undefined ? (b.isActive ? " — فعال شد" : " — غیرفعال شد") : ""),
    });
    return json({ ok: true });
  }

  // DELETE → حذف
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    if (id === actor.id) return json({ error: "نمی‌توانید خودتان را حذف کنید" }, 400);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: error.message }, 500);
    await admin.from("audit_logs").insert({
      actor_id: actor.id,
      actor_name: await actorName(admin, actor.id),
      action: "DELETE_USER",
      entity_type: "User",
      entity_id: id,
      result: "success",
      details: "حذف کاربر",
    });
    return json({ ok: true });
  }

  return json({ error: "متد پشتیبانی نمی‌شود" }, 405);
});

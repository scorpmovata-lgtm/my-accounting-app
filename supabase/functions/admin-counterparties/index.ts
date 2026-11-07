// supabase/functions/admin-counterparties/index.ts
// مدیریت طرف‌حساب‌های «مشترک» توسط ادمین — نسخه ۳.۰
// GET (لیست) / POST (ایجاد طرف‌حساب مشترک یا grant/revoke دسترسی)
// PUT (ویرایش + لینک کاربر = دادن پنل) / DELETE (حذف)
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

  if (req.method === "GET") {
    const { data, error } = await admin.from("counterparties").select("*").order("created_at");
    if (error) return json({ error: error.message }, 500);
    return json({ counterparties: data });
  }

  if (req.method === "POST") {
    const b = await req.json();

    // ---- action: grant / revoke (نسخه ۳) ----
    if (b.action === "grant" || b.action === "revoke") {
      const userId = b.userId;
      const counterpartyId = b.counterpartyId;
      if (!userId || !counterpartyId)
        return json({ error: "userId و counterpartyId الزامی" }, 400);
      const { data: cp } = await admin
        .from("counterparties").select("id, display_name, is_shared, linked_user_id")
        .eq("id", counterpartyId).maybeSingle();
      if (!cp) return json({ error: "طرف حساب یافت نشد" }, 404);
      if (cp.is_shared === false)
        return json({ error: "طرف حساب شخصی است؛ گرنت معنا ندارد" }, 400);
      if (cp.linked_user_id === userId)
        return json({ error: "این کاربر نماینده خودِ این طرف حساب است" }, 400);
      const { data: target } = await admin
        .from("user_profiles").select("display_name").eq("id", userId).maybeSingle();
      if (!target) return json({ error: "کاربر یافت نشد" }, 404);

      if (b.action === "grant") {
        const { error } = await admin.from("counterparty_access").insert({
          user_id: userId,
          counterparty_id: counterpartyId,
          granted_by: actor.id,
        });
        if (error) {
          if (String(error.code) === "23505")
            return json({ ok: true, note: "این دسترسی از قبل وجود دارد" });
          return json({ error: error.message }, 500);
        }
        await admin.from("audit_logs").insert({
          actor_id: actor.id,
          actor_name: await actorName(admin, actor.id),
          action: "GRANT_CP_ACCESS",
          entity_type: "CounterpartyAccess",
          entity_id: counterpartyId,
          result: "success",
          details: "دادن دسترسی طرف‌حساب «" + cp.display_name + "» به «" + target.display_name + "»",
        });
        return json({ ok: true });
      }

      // revoke
      await admin.from("counterparty_access")
        .delete()
        .eq("user_id", userId)
        .eq("counterparty_id", counterpartyId);
      await admin.from("audit_logs").insert({
        actor_id: actor.id,
        actor_name: await actorName(admin, actor.id),
        action: "REVOKE_CP_ACCESS",
        entity_type: "CounterpartyAccess",
        entity_id: counterpartyId,
        result: "success",
        details: "گرفتن دسترسی طرف‌حساب «" + cp.display_name + "» از «" + target.display_name + "»",
      });
      return json({ ok: true });
    }

    // ---- ایجاد طرف‌حساب مشترک ----
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
      is_shared: true, // طرف‌حساب‌های ادمین همیشه مشترک‌اند
      owner_user_id: null,
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

    // فقط طرف‌حساب مشترک قابل ویرایش توسط ادمین است
    const { data: cp } = await admin
      .from("counterparties").select("is_shared, owner_user_id").eq("id", id).maybeSingle();
    if (!cp) return json({ error: "طرف حساب یافت نشد" }, 404);
    if (cp.is_shared === false)
      return json({ error: "طرف حساب شخصی فقط به مالکش تعلق دارد" }, 403);

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
    const { data: cpAfter } = await admin.from("counterparties").select("linked_user_id").eq("id", id).maybeSingle();
    if (cpAfter?.linked_user_id) {
      await admin.from("user_profiles").update({ linked_counterparty_id: id }).eq("id", cpAfter.linked_user_id);
    }
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    const { data: cp } = await admin
      .from("counterparties").select("is_shared").eq("id", id).maybeSingle();
    if (!cp) return json({ ok: true });
    if (cp.is_shared === false)
      return json({ error: "حذف طرف حساب شخصی به مالکش واگذار شده است" }, 403);
    const { count } = await admin.from("transactions").select("*", { count: "exact", head: true }).eq("counterparty_id", id);
    if (count && count > 0) return json({ error: "طرف حساب تراکنش دارد و قابل حذف نیست" }, 400);
    await admin.from("counterparty_access").delete().eq("counterparty_id", id);
    await admin.from("counterparties").delete().eq("id", id);
    return json({ ok: true });
  }

  return json({ error: "متد پشتیبانی نمی‌شود" }, 405);
});

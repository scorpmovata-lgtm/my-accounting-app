// مصنوعات دیپلوی نسخه ۲.۰ — دفتر حسابداری چندکاربری با تطابق خودکار
// ============================================================
// این فایل شامل:
//   ۱) SCHEMA_SQL_V2       — ساختار کامل PostgreSQL + RLS + تابع is_admin
//   ۲) CREATE_TRANSACTION_FN_V2 — Edge Function ثبت تراکنش با منطق تطابق
//   ۳) ADMIN_USERS_FN_V2   — Edge Function مدیریت کاربران (CRUD توسط ادمین)
//   ۴) ADMIN_COUNTERPARTIES_FN_V2 — Edge Function مدیریت طرف حساب‌ها
//   ۵) DEPLOYMENT_STEPS_V2 — مراحل گام‌به‌گام دیپلوی
//
// نکته مهم درباره احراز هویت با username:
//   Supabase Auth به‌صورت پیش‌فرض email/password است. ما برای پشتیبانی
//   از username، از email ساختگی به‌صورت username + "@accounting.local"
//   استفاده می‌کنیم و username واقعی را در جدول user_profiles ذخیره
//   می‌کنیم. کلاینت هنگام ورود: email = username + "@accounting.local".

// ---------------------------------------------------------------------------
// ۱) SQL SCHEMA
// ---------------------------------------------------------------------------

export const SCHEMA_SQL_V2 = `-- ============================================================
-- دفتر حسابداری چندکاربری — نسخه ۲.۰
-- اجرا در: Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- ۰) پاک‌سازی نسخه‌ی قبلی (v1) — جدول‌های قدیمی را حذف می‌کند
-- توجه: این کار داده‌های نسخه‌ی قبلی را پاک می‌کند (که با v2 ناسازگار است).
-- auth.users دست‌نخورده باقی می‌ماند (کاربران احراز‌شده حفظ می‌شوند).
-- ============================================================
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.telegram_links CASCADE;
DROP TABLE IF EXISTS public.telegram_link_codes CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.counterparties CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP FUNCTION IF EXISTS public.is_admin();
DROP FUNCTION IF EXISTS public.make_admin(uuid, text, text);

-- ۱) پروفایل کاربران
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  role text not null default 'user' check (role in ('admin','user')),
  scope text check (scope in ('balance_only','transaction_list')),
  linked_counterparty_id uuid,
  telegram_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- اگر جدول از قبل ساخته شده، ستون تلگرام را اضافه کن (بدون آسیب به داده‌ها)
alter table public.user_profiles
  add column if not exists telegram_enabled boolean not null default true;

-- ۲) طرف حساب‌ها (متمرکز)
create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  notes text,
  linked_user_id uuid references auth.users(id) on delete set null,
  linked_username text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.user_profiles
  drop constraint if exists fk_user_linked_cp,
  add constraint fk_user_linked_cp
  foreign key (linked_counterparty_id) references public.counterparties(id) on delete set null;

-- ۳) تراکنش‌ها
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid not null references public.counterparties(id) on delete restrict,
  direction text not null check (direction in ('received_from','paid_to')),
  amount bigint not null check (amount > 0),
  currency text not null default 'IRT' check (currency in ('IRT','IRR')),
  effective_at text not null, -- شمسی yyyy-mm-dd
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  description text,
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  matched_transaction_id uuid,
  match_status text not null default 'pending' check (match_status in ('unmatched','pending','matched')),
  idempotency_key text not null,
  unique (user_id, idempotency_key)
);

alter table public.transactions
  drop constraint if exists fk_matched,
  add constraint fk_matched
  foreign key (matched_transaction_id) references public.transactions(id) on delete set null;

-- ۴) گزارش‌های ممیزی
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  result text not null check (result in ('success','failure')),
  details text,
  created_at timestamptz not null default now()
);

-- ایندکس‌ها
create index if not exists idx_txn_user on public.transactions(user_id);
create index if not exists idx_txn_cp on public.transactions(counterparty_id);
create index if not exists idx_txn_effective on public.transactions(effective_at);
create index if not exists idx_txn_match on public.transactions(match_status);
create index if not exists idx_cp_linked on public.counterparties(linked_user_id);
create index if not exists idx_audit_actor on public.audit_logs(actor_id);

-- ============================================================
-- تابع کمکی: آیا کاربر فعلی ادمین است؟
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.user_profiles enable row level security;
alter table public.counterparties enable row level security;
alter table public.transactions enable row level security;
alter table public.audit_logs enable row level security;

-- user_profiles: همه احراز‌شده می‌بینند؛ فقط ادمین نوشتن
drop policy if exists "profiles_select" on public.user_profiles;
drop policy if exists "profiles_admin_write" on public.user_profiles;
create policy "profiles_select" on public.user_profiles
  for select to authenticated using (true);
create policy "profiles_admin_write" on public.user_profiles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- counterparties: همه می‌بینند؛ فقط ادمین نوشتن
drop policy if exists "cp_select" on public.counterparties;
drop policy if exists "cp_admin_write" on public.counterparties;
create policy "cp_select" on public.counterparties
  for select to authenticated using (true);
create policy "cp_admin_write" on public.counterparties
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- transactions: کاربر فقط دفتر خودش را می‌بیند؛ نوشتن فقط از طریق Edge Function (service_role)
drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own" on public.transactions
  for select to authenticated using (user_id = auth.uid());

-- audit_logs: کاربر گزارش‌های خودش را می‌بیند؛ ادمین همه را
drop policy if exists "audit_select" on public.audit_logs;
create policy "audit_select" on public.audit_logs
  for select to authenticated using (actor_id = auth.uid() or public.is_admin());

-- ============================================================
-- ۵) تلگرام: کدهای اتصال و لینک‌های اتصال (ربات استعلام)
-- ============================================================
create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_username text,
  status text not null default 'linked' check (status in ('linked','revoked')),
  linked_at timestamptz not null default now()
);

create index if not exists idx_tg_codes_code on public.telegram_link_codes(code);
create index if not exists idx_tg_codes_user on public.telegram_link_codes(user_id);
create index if not exists idx_tg_links_user on public.telegram_links(user_id);

-- RLS تلگرام: کاربر فقط رکوردهای خودش؛ ربات با service_role بدون محدودیت
alter table public.telegram_link_codes enable row level security;
alter table public.telegram_links enable row level security;

drop policy if exists "tg_codes_select_own" on public.telegram_link_codes;
drop policy if exists "tg_codes_insert_own" on public.telegram_link_codes;
drop policy if exists "tg_codes_delete_own" on public.telegram_link_codes;
create policy "tg_codes_select_own" on public.telegram_link_codes
  for select to authenticated using (user_id = auth.uid());
create policy "tg_codes_insert_own" on public.telegram_link_codes
  for insert to authenticated with check (user_id = auth.uid());
create policy "tg_codes_delete_own" on public.telegram_link_codes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "tg_links_select_own" on public.telegram_links;
drop policy if exists "tg_links_delete_own" on public.telegram_links;
create policy "tg_links_select_own" on public.telegram_links
  for select to authenticated using (user_id = auth.uid());
create policy "tg_links_delete_own" on public.telegram_links
  for delete to authenticated using (user_id = auth.uid());

-- ادمین: ساخت کد برای هر کاربر + مشاهده/قطع اتصال همه کاربران
-- (مدیریت کدها از منوی «مدیریت» → «اتصال تلگرام کاربران»)
drop policy if exists "tg_codes_admin_all" on public.telegram_link_codes;
drop policy if exists "tg_links_admin_all" on public.telegram_links;
create policy "tg_codes_admin_all" on public.telegram_link_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tg_links_admin_all" on public.telegram_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- تابع کمکی: تبدیل یک کاربر به ادمین
-- پس از ساخت اولین کاربر در Supabase Auth، اجرا کنید:
--   select public.make_admin('UUID-OF-USER', 'vahid', 'وحید');
-- ============================================================
create or replace function public.make_admin(target_uid uuid, uname text default 'admin', dname text default 'ادمین')
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_profiles (id, username, display_name, role)
  values (target_uid, uname, dname, 'admin')
  on conflict (id) do update set role = 'admin', username = excluded.username, display_name = excluded.display_name;
$$;
`;

// ---------------------------------------------------------------------------
// ۱-ب) SQL افزودنی تلگرام — برای نصب‌های موجود (بدون پاک شدن داده‌ها)
// ---------------------------------------------------------------------------

export const TELEGRAM_SCHEMA_SQL = `-- ============================================================
-- افزودنی تلگرام (نسخه ۲.۱) — خودترمیم + بدون حذف داده‌های نسخه ۲
-- برای همه نصب‌ها لازم است (نصب جدید و موجود).
-- اگر جدول‌های تلگرامِ «نسخه ۱» با ساختار قدیمی موجود باشند،
-- فقط همان‌ها حذف و با ساختار جدید بازسازی می‌شوند.
-- ============================================================

-- --- ترمیم: حذف جدول‌های قدیمی ناسازگار (نسخه ۱) ---
-- جدول قدیمی telegram_links ستون‌های ledger_id/contact_id دارد (نسخه ۱)
-- و جدول قدیمی telegram_link_codes ستون user_id ندارد.
-- این بلوک فقط جدول‌هایی را حذف می‌کند که ساختار قدیمی دارند؛
-- به جدول‌های سالم نسخه ۲ هیچ آسیبی نمی‌زند.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'telegram_links')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'telegram_links'
               and column_name = 'user_id') then
    drop table if exists public.telegram_links cascade;
  end if;
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'telegram_link_codes')
     and not exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'telegram_link_codes'
               and column_name = 'user_id') then
    drop table if exists public.telegram_link_codes cascade;
  end if;
end
$$;

-- --- ترمیم: تریگر قدیمی نسخه ۱ روی auth.users غیرفعال می‌شود ---
-- (این تریگر هنگام ساخت کاربر جدید به جدول‌های نسخه ۱ می‌نوشت)
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create table if not exists public.telegram_link_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  telegram_user_id bigint not null unique,
  telegram_username text,
  status text not null default 'linked' check (status in ('linked','revoked')),
  linked_at timestamptz not null default now()
);

create index if not exists idx_tg_codes_code on public.telegram_link_codes(code);
create index if not exists idx_tg_codes_user on public.telegram_link_codes(user_id);
create index if not exists idx_tg_links_user on public.telegram_links(user_id);

alter table public.telegram_link_codes enable row level security;
alter table public.telegram_links enable row level security;

drop policy if exists "tg_codes_select_own" on public.telegram_link_codes;
drop policy if exists "tg_codes_insert_own" on public.telegram_link_codes;
drop policy if exists "tg_codes_delete_own" on public.telegram_link_codes;
create policy "tg_codes_select_own" on public.telegram_link_codes
  for select to authenticated using (user_id = auth.uid());
create policy "tg_codes_insert_own" on public.telegram_link_codes
  for insert to authenticated with check (user_id = auth.uid());
create policy "tg_codes_delete_own" on public.telegram_link_codes
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "tg_links_select_own" on public.telegram_links;
drop policy if exists "tg_links_delete_own" on public.telegram_links;
create policy "tg_links_select_own" on public.telegram_links
  for select to authenticated using (user_id = auth.uid());
create policy "tg_links_delete_own" on public.telegram_links
  for delete to authenticated using (user_id = auth.uid());

-- ادمین: ساخت کد برای هر کاربر + مشاهده/قطع اتصال همه کاربران
-- (مدیریت کدها از منوی «مدیریت» → «اتصال تلگرام کاربران»)
drop policy if exists "tg_codes_admin_all" on public.telegram_link_codes;
drop policy if exists "tg_links_admin_all" on public.telegram_links;
create policy "tg_codes_admin_all" on public.telegram_link_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "tg_links_admin_all" on public.telegram_links
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ستون اجازه اتصال تلگرام (ادمین می‌تواند برای هر کاربر خاموش/روشن کند)
alter table public.user_profiles
  add column if not exists telegram_enabled boolean not null default true;
`;

// ---------------------------------------------------------------------------
// ۲) CREATE_TRANSACTION Edge Function
// ---------------------------------------------------------------------------

export const CREATE_TRANSACTION_FN_V2 = `// supabase/functions/create-transaction/index.ts
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
`;

// ---------------------------------------------------------------------------
// ۳) ADMIN-USERS Edge Function
// ---------------------------------------------------------------------------

export const ADMIN_USERS_FN_V2 = `// supabase/functions/admin-users/index.ts
// مدیریت کاربران توسط ادمین: GET (لیست) / POST (ایجاد) / PUT (ویرایش) / DELETE (حذف)
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
    .from("user_profiles").select("role").eq("id", user.id).maybeSingle();
  if (!prof || prof.role !== "admin")
    return { error: json({ error: "فقط ادمین دسترسی دارد" }, 403) };
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

    // درج پروفایل
    const { error: profErr } = await admin.from("user_profiles").insert({
      id: newUser.user.id,
      username,
      display_name: displayName,
      role,
      scope: role === "user" ? scope : null,
    });
    if (profErr) return json({ error: profErr.message }, 500);

    // ایجاد طرف حساب هم‌نام و لینک (اگر خواسته شده)
    if (makeCounterparty) {
      const { data: cp } = await admin.from("counterparties").insert({
        display_name: displayName,
        linked_user_id: newUser.user.id,
        linked_username: username,
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

  // PUT → ویرایش
  if (req.method === "PUT") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    const b = await req.json();
    const patch = {};
    if (b.displayName) patch.display_name = b.displayName.trim();
    if (b.scope) patch.scope = b.scope;
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
      details: "ویرایش کاربر",
    });
    return json({ ok: true });
  }

  // DELETE → حذف
  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "id الزامی" }, 400);
    if (id === actor.id) return json({ error: "نمی‌توان خودتان را حذف کنید" }, 400);
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
`;

// ---------------------------------------------------------------------------
// ۴) ADMIN-COUNTERPARTIES Edge Function
// ---------------------------------------------------------------------------

export const ADMIN_COUNTERPARTIES_FN_V2 = `// supabase/functions/admin-counterparties/index.ts
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
`;

// ---------------------------------------------------------------------------
// ۵) مراحل دیپلوی
// ---------------------------------------------------------------------------

export const DEPLOYMENT_STEPS_V2: { title: string; body: string }[] = [
  {
    title: "گام ۱ — اجرای SQL Schema (در مرورگر — Supabase Dashboard)",
    body: `۱. وارد supabase.com شوید و پروژه‌تان را باز کنید (npmbfmbxjjvrnfapvaik).
۲. از منوی چپ: SQL Editor → دکمه «New query».
۳. فایل supabase/schema-v2.sql را از VSCode باز کنید، کل آن را کپی کنید (Ctrl+A بعد Ctrl+C) و در کادر SQL Editor بچسبانید (Ctrl+V).
۴. دکمه «Run» (یا Ctrl+Enter) را بزنید و صبر کنید پیام «Success» بیاید.

✅ نتیجه: جداول user_profiles ، counterparties ، transactions ، audit_logs ساخته می‌شوند.
⚠️ اگر قبلاً نسخه ۱ را اجرا کرده‌اید، داده‌های قدیمی پاک می‌شوند (طبیعی است).`,
  },
  {
    title: "گام ۲ — ساخت کاربر ادمین (در مرورگر — Supabase Dashboard)",
    body: `۱. از منوی چپ: Authentication → Users → دکمه «Add user» → «Create new user».
۲. ایمیل: vahid@accounting.local  — رمز: 1234
۳. ✅ تیک «Auto Confirm User» را حتماً روشن کنید → «Create user».
۴. روی ردیف کاربر کلیک کنید و UUID او را کپی کنید (رشته طولانی کنار ID).
۵. برگردید به SQL Editor و این دستور را با UUID خودتان اجرا کنید:

select public.make_admin('UUID-اینجا-کپی-شده', 'vahid', 'وحید');

✅ نتیجه: حالا می‌توانید در اپ با vahid / 1234 وارد شوید.`,
  },
  {
    title: "گام ۳ — دیپلوی سه Edge Function (در VSCode ترمینال)",
    body: `فایل‌های توابع از قبل در پوشه supabase/functions/ داخل پروژه هستند — چیزی لازم نیست بسازید. فقط در ترمینال VSCode (Ctrl + ù) این ۵ دستور را یکی‌یکی اجرا کنید:

npm install -g supabase          ← نصب CLI (فقط یک‌بار)
supabase login                   ← مرورگر باز می‌شود؛ با اکانت Supabase وارد شوید
supabase link --project-ref npmbfmbxjjvrnfapvaik
supabase functions deploy create-transaction
supabase functions deploy admin-users
supabase functions deploy admin-counterparties

✅ نتیجه: در Dashboard → Edge Functions هر سه تابع با وضعیت Active دیده می‌شوند.
💡 اگر npm ندارید، اول Node.js را از nodejs.org نصب کنید.`,
  },
  {
    title: "گام ۴ — بررسی دیپلوی (این گام ساده شد — Secret لازم نیست!)",
    body: `💡 نکته مهم: نسخه‌های جدید Supabase CLI کلید SUPABASE_SERVICE_ROLE_KEY را به‌صورت خودکار داخل هر تابع تزریق می‌کنند و اجازه نمی‌دهند دستی ستش کنید. اگر هنگام secrets set پیام «Env name cannot start with SUPABASE_, skipping» دیدید، کاملاً طبیعی است — یعنی کلید از قبل خودکار موجود است و این گام کلاً حذف شده.

فقط بررسی کنید:
۱. در Dashboard از منوی چپ: Edge Functions
۲. باید هر سه تابع ببینید: create-transaction ، admin-users ، admin-counterparties
۳. وضعیت هر سه Active باشد.

✅ نتیجه: توابع آماده‌اند — service_role خودکار تزریق شده. به گام ۵ بروید.`,
  },
  {
    title: "گام ۵ — انتشار روی GitHub و Vercel",
    body: `۱. در ترمینال VSCode از ریشه پروژه:

git add .
git commit -m "v2.0"
git push

۲. در Vercel: پروژه → Settings → Environment Variables → دکمه «Add New» و این دو را اضافه کنید:

   نام: NEXT_PUBLIC_SUPABASE_URL
   مقدار: (از Dashboard → Project Settings → API → Project URL کپی کنید)

   نام: NEXT_PUBLIC_SUPABASE_ANON_KEY
   مقدار: (از همان صفحه → کلید anon public کپی کنید)

۳. در Vercel تب Deployments → آخرین دیپلوی → «⋯» → «Redeploy».

✅ نتیجه: اپ واقعی شما روی آدرس vercel شما فعال می‌شود (وصل به Supabase).`,
  },
  {
    title: "گام ۶ — تست نهایی تطابق خودکار",
    body: `۱. وارد اپ شوید: vahid / 1234
۲. منو ☰ → «مدیریت ادمین» → کاربر جدید بسازید: faezeh با رمز 1234 (طرف حساب لینک‌شده خودکار ساخته می‌شود).
۳. با vahid: «افزودن تراکنش» → «پرداخت به فائزه» مبلغ ۱٬۰۰۰٬۰۰۰ → ثبت. وضعیت: در انتظار تأیید ⏳
۴. خروج → با faezeh / 1234 وارد شوید → «افزودن تراکنش» → «دریافت از وحید» همان مبلغ و همان تاریخ → ثبت.
۵. هر دو تراکنش خودکار «تطبیق‌یافته» ✅ می‌شوند و زوج‌شان در لیست کنار هم نمایش داده می‌شود.`,
  },
  {
    title: "گام ۷ — ربات استعلام تلگرام (اختیاری)",
    body: `رباتی می‌سازید که هر کاربر با کد ۶ رقمی که «ادمین» به او می‌دهد، تلگرامش را وصل می‌کند و مانده خودش را می‌بیند. ساخت کد از منوی «مدیریت» ← بخش «اتصال تلگرام کاربران» انجام می‌شود.

۱. اجرای SQL تلگرام: فایل supabase/telegram-schema.sql را در SQL Editor اجرا کنید
   (این فایل جدول‌های تلگرام + دسترسی ادمین + ستون telegram_enabled را می‌سازد؛
   به داده‌های قبلی آسیب نمی‌زند — برای نصب‌های موجود هم لازم است).
۲. ساخت ربات: در تلگرام به @BotFather → دستور /newbot → یک نام و یک username بدهید
   (username باید به bot ختم شود، مثلا myaccbot) → توکن (مثل 123456:ABC-DEF...) را کپی کنید.
۳. دیپلوی تابع ربات (ترمینال VSCode):
   supabase functions deploy telegram-bot --no-verify-jwt
۴. ست کردن توکن ربات:
   supabase secrets set TELEGRAM_BOT_TOKEN=توکن-کپی-شده
۵. فعال‌سازی webhook — این آدرس را در مرورگر باز کنید (توکن و ref خودتان):
   https://api.telegram.org/botتوکن-شما/setWebhook?url=https://npmbfmbxjjvrnfapvaik.supabase.co/functions/v1/telegram-bot
   باید پاسخ "ok":true بدهد.
۶. ساخت کد برای کاربر: وارد اپ شوید (vahid / 1234) → منو ☰ → «مدیریت» →
   بخش «اتصال تلگرام کاربران» → کنار کاربر دکمه «ساخت کد اتصال» →
   کد ۶ رقمی نمایش داده می‌شود → «کپی کد» → کد را به کاربر بدهید
   (با کلید «اجازه اتصال» هم می‌توانید دسترسی هر کاربر را خاموش/روشن کنید).
۷. تست: کاربر کد را در ربات می‌فرستد → «✅ اتصال موفق» → دکمه «📊 مانده من».

✅ نتیجه: هر کاربر مانده خودش را در تلگرام می‌بیند (طبق سطح دسترسی‌اش) و
ادمین کنترل کامل دارد: چه کسی وصل شود، چه کسی نشود.
⚠️ توکن ربات را به GitHub ندهید.`,
  },
];

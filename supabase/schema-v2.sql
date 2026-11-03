-- ============================================================
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

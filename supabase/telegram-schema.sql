-- ============================================================
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

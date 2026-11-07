-- ============================================================
-- مهاجرت به نسخه ۳.۰ (۳.۰.۳) — دفترهای مستقل + دید دوجانبه + کامنت
-- اجرا در: Supabase Dashboard → SQL Editor
-- ✔ روی هر نصبی که نسخه ۲ (schema-v2.sql + telegram-schema.sql) را
--   اجرا کرده، همین فایل را اجرا کنید. کاملاً idempotent است و
--   اجرای چندباره خطا نمی‌دهد. داده‌های موجود حفظ می‌شوند
--   (direction تراکنش‌های قدیمی به kind تبدیل می‌شود).
-- ⚠ برای نصب از صفر: اول schema-v2.sql، بعد telegram-schema.sql، بعد این فایل.
-- ✔ ترتیب: اول ستون‌ها و جدول‌ها، بعد توابع امنیتی (چون توابع
--   language sql در لحظه ساخت اعتبارسنجی می‌شوند).
-- ✔ خودترمیمی: جدول‌های ناقصِ به‌جامانده از تلاش‌های قبلی به‌طور
--   خودکار شناسایی و از نو ساخته می‌شوند.
-- ============================================================

-- ============================================================
-- ۰) خودترمیمی: جدول‌های ناقصِ به‌جامانده از تلاش‌های قبلی
-- اگر جدولی از قبل با ساختار ناسازگار (مثلاً بدون ستون user_id)
-- موجود باشد، حذف و در ادامه از نو ساخته می‌شود؛
-- جدول‌های سالم و داده‌های درست دست‌نخورده می‌مانند.
-- ============================================================
do $$
begin
  -- categories باید user_id از نوع uuid داشته باشد
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'categories')
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'categories'
         and column_name = 'user_id' and udt_name = 'uuid'
     ) then
    drop table public.categories cascade;
  end if;

  -- counterparty_access باید user_id از نوع uuid داشته باشد
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'counterparty_access')
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'counterparty_access'
         and column_name = 'user_id' and udt_name = 'uuid'
     ) then
    drop table public.counterparty_access cascade;
  end if;

  -- transaction_comments باید author_id از نوع uuid داشته باشد
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'transaction_comments')
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'transaction_comments'
         and column_name = 'author_id' and udt_name = 'uuid'
     ) then
    drop table public.transaction_comments cascade;
  end if;
end
$$;

-- حذف تریگرهای سرگردانِ به‌جامانده از تلاش‌های قبلی روی تراکنش‌ها
-- (نسخه ۳ هیچ تریگری روی transactions ندارد؛ تریگر خراب می‌تواند
--  خطای «column does not exist» هنگام UPDATE بدهد)
do $$
declare r record;
begin
  for r in
    select trigger_name from information_schema.triggers
    where event_object_schema = 'public' and event_object_table = 'transactions'
      and trigger_name not like 'pg_%'
  loop
    execute format('drop trigger if exists %I on public.transactions', r.trigger_name);
  end loop;
end
$$;

-- ============================================================
-- ۱) ساختار: ستون‌ها و جدول‌های جدید (قبل از توابع!)
-- ============================================================

-- ۱-۱) کاربران: ستون فعال/غیرفعال (ادمین می‌تواند کاربر را غیرفعال کند)
alter table public.user_profiles
  add column if not exists is_active boolean not null default true;

-- ۱-۲) طرف‌حساب‌ها: مشترک/شخصی
alter table public.counterparties
  add column if not exists is_shared boolean not null default true,
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

-- (طرف‌حساب‌های موجود که ادمین ساخته → is_shared=true خودکار با DEFAULT)

-- ۱-۳) جدول گرنت دسترسی به طرف‌حساب‌های مشترک
create table if not exists public.counterparty_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid not null references public.counterparties(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (user_id, counterparty_id)
);

-- خودترمیمی ستون‌ها (اگر جدول از قبل با ستون‌های ناقص مانده)
alter table public.counterparty_access
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists counterparty_id uuid references public.counterparties(id) on delete cascade,
  add column if not exists granted_by uuid references auth.users(id),
  add column if not exists created_at timestamptz not null default now();

-- ۱-۴) دسته‌بندی‌های شخصی هر کاربر
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- خودترمیمی ستون‌ها
alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists name text,
  add column if not exists created_at timestamptz not null default now();

-- ۱-۵) کامنت روی ردیف تراکنش (دوطرفه)
create table if not exists public.transaction_comments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

-- خودترمیمی ستون‌ها
alter table public.transaction_comments
  add column if not exists transaction_id uuid references public.transactions(id) on delete cascade,
  add column if not exists author_id uuid references auth.users(id) on delete cascade,
  add column if not exists author_name text,
  add column if not exists body text,
  add column if not exists created_at timestamptz not null default now();

-- ۱-۶) تراکنش‌ها: ستون kind (شش نوع) + دسته‌بندی
alter table public.transactions
  add column if not exists kind text,
  add column if not exists category_id uuid references public.categories(id) on delete set null;

-- ============================================================
-- ۲) توابع کمکی امن (SECURITY DEFINER — بدون درگیری RLS تودرتو)
-- ============================================================

-- آیا کاربر جاری ادمین است؟ (از schema-v2 موجود)
create or replace function public.is_admin()
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- آیا کاربر جاری می‌تواند این طرف‌حساب را ببیند؟
--   ادمین: همه | شخصی: فقط مالکش | مشترک: فقط با گرنت | لینک‌شده به خودش
create or replace function public.cp_visible_to_me(v_cp uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.counterparties c
    where c.id = v_cp
      and (
        exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.role = 'admin' and p.is_active)
        or (c.is_shared = false and c.owner_user_id = auth.uid())
        or (
          c.is_shared
          and exists (
            select 1 from public.counterparty_access a
            where a.counterparty_id = v_cp and a.user_id = auth.uid()
          )
        )
        or c.linked_user_id = auth.uid()
      )
  );
$$;

-- آیا کاربر جاری می‌تواند این تراکنش را ببیند؟
--   صاحب دفتر یا کسی که تراکنش روی طرف‌حسابِ لینک‌شده به اوست
create or replace function public.txn_visible_to_me(v_txn uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.transactions t
    where t.id = v_txn
      and (
        t.user_id = auth.uid()
        or exists (
          select 1 from public.counterparties c
          where c.id = t.counterparty_id and c.linked_user_id = auth.uid()
        )
      )
  );
$$;

-- آیا کاربر جاری می‌تواند کامنت‌های این تراکنش را ببیند/بگذارد؟
create or replace function public.comment_visible_to_me(v_txn uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select public.txn_visible_to_me(v_txn);
$$;

-- ============================================================
-- ۳) تبدیل داده قدیمی: direction → kind (اجرای مجدد امن است)
-- ============================================================
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'transactions'
               and column_name = 'direction') then
    update public.transactions set kind = direction where kind is null;
  end if;
end
$$;

-- اگر تراکنش قدیمی بدون kind مانده (نباید)، مقدار پیش‌فرض
update public.transactions set kind = 'paid_to' where kind is null;

alter table public.transactions alter column kind set not null;

alter table public.transactions drop constraint if exists txn_kind_check;
alter table public.transactions
  add constraint txn_kind_check
  check (kind in ('opening_claim','opening_debt','claim','debt','paid_to','received_from'));

-- ستون‌های تطابق (نسخه ۲) حذف می‌شوند — دیگر مورد استفاده نیستند
alter table public.transactions drop constraint if exists fk_matched;
alter table public.transactions drop column if exists matched_transaction_id;
alter table public.transactions drop column if exists match_status;
alter table public.transactions drop column if exists direction;

-- ============================================================
-- ۴) RLS: دسته‌بندی‌های شخصی
-- ============================================================
alter table public.categories enable row level security;

drop policy if exists "cat_own_all" on public.categories;
create policy "cat_own_all" on public.categories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- ۵) RLS: گرنت‌های دسترسی (خواندن فقط؛ نوشتن از طریق Edge Function ادمین)
-- ============================================================
alter table public.counterparty_access enable row level security;

-- کاربر گرنت‌های خودش را می‌بیند؛ ادمین همه را
drop policy if exists "cp_access_select" on public.counterparty_access;
create policy "cp_access_select" on public.counterparty_access
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- ۶) RLS: طرف‌حساب‌ها
-- ============================================================

-- سیاست دیدن طرف‌حساب‌ها جایگزین می‌شود (نسخه ۲ همه را می‌دیدند)
drop policy if exists "cp_select" on public.counterparties;
create policy "cp_select" on public.counterparties
  for select to authenticated
  using (public.cp_visible_to_me(id));

-- کاربر می‌تواند طرف‌حساب «شخصی» خودش را بسازد/ویرایش/حذف کند
drop policy if exists "cp_own_private_write" on public.counterparties;
create policy "cp_own_private_write" on public.counterparties
  for all to authenticated
  using (is_shared = false and owner_user_id = auth.uid())
  with check (is_shared = false and owner_user_id = auth.uid());

-- ============================================================
-- ۷) RLS: تراکنش‌ها
-- ============================================================

-- سیاست دیدن: دفتر خودم + تراکنش‌هایی که دیگران درباره من ثبت کرده‌اند
drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own" on public.transactions
  for select to authenticated
  using (public.txn_visible_to_me(id));

-- ============================================================
-- ۸) RLS: کامنت‌ها
-- ============================================================
alter table public.transaction_comments enable row level security;

drop policy if exists "tc_select" on public.transaction_comments;
create policy "tc_select" on public.transaction_comments
  for select to authenticated
  using (author_id = auth.uid() or public.comment_visible_to_me(transaction_id));

drop policy if exists "tc_insert" on public.transaction_comments;
create policy "tc_insert" on public.transaction_comments
  for insert to authenticated
  with check (author_id = auth.uid() and public.comment_visible_to_me(transaction_id));

-- ============================================================
-- ۹) ایندکس‌ها
-- ============================================================
create index if not exists idx_tc_txn on public.transaction_comments(transaction_id);
create index if not exists idx_cat_user on public.categories(user_id);
create index if not exists idx_cpa_user_cp on public.counterparty_access(user_id, counterparty_id);

-- ============================================================
-- ۱۰) گزارش‌های ممیزی نمونه (اگر جدول موجود است — از v2)
-- ============================================================
-- (audit_logs دست‌نخورده می‌ماند؛ EF ها رکورد جدید می‌نویسند)

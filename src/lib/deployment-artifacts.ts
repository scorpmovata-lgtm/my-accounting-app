// اسناد و کد آماده‌ی دیپلوی برای فاز ۲
// این فایل محتوای SQL، Edge Function و ربات تلگرام را به‌صورت رشته نگه می‌دارد
// تا در تب «راه‌اندازی» نمایش داده و قابل کپی باشد.

export interface DeploymentStep {
  title: string;
  detail: string;
  command?: string;
}

export const DEPLOYMENT_STEPS: DeploymentStep[] = [
  {
    title: "ایجاد پروژه Supabase",
    detail:
      "وارد supabase.com شو → New Project. نام: my-accounting، منطقه: Frankfurt. رمز دیتابیس را در .env ذخیره کن.",
  },
  {
    title: "اجرای SQL Schema",
    detail:
      "در داشبورد Supabase → SQL Editor → New query. محتوای فایل «۱. SQL Schema» را paste کن و Run بزن. این کار همه جداول، RLS policies و triggers را می‌سازد.",
  },
  {
    title: "نصب Supabase CLI",
    detail: "در ترمینال VS Code بنویس:",
    command: "npm install -g supabase",
  },
  {
    title: "ورود به Supabase CLI",
    detail: "با دستور زیر لاگین کن (مرورگر باز می‌شود):",
    command: "supabase login",
  },
  {
    title: "اتصال به پروژه",
    detail:
      "Project Ref ID را از Settings → API کپی کن. در پوشه پروژه این را اجرا کن:",
    command: "supabase link --project-ref <PROJECT_REF_ID>",
  },
  {
    title: "تنظیم اسرار Edge Function",
    detail: "این سه secret را تنظیم کن (با کلیدهای واقعی از Settings → API):",
    command:
      "supabase secrets set SUPABASE_URL=https://<project>.supabase.co\nsupabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service_role_key>\nsupabase secrets set TELEGRAM_BOT_TOKEN=<bot_token>",
  },
  {
    title: "دیپلوی Edge Function ثبت تراکنش",
    detail: "فایل‌های functions را در supabase/functions بگذار و سپس دیپلوی کن:",
    command: "supabase functions deploy create-transaction --no-verify-jwt",
  },
  {
    title: "دیپلوی ربات تلگرام",
    detail: "همان Edge Function بات را هم دیپلوی کن:",
    command: "supabase functions deploy telegram-bot --no-verify-jwt",
  },
  {
    title: "تنظیم Webhook تلگرام",
    detail:
      "به تلگرام بگو آپدیت‌ها را به Edge Function بات بفرست. این URL را در BotFather یا با curl اجرا کن:",
    command:
      'curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.supabase.co/functions/v1/telegram-bot"',
  },
  {
    title: "تست ربات",
    detail:
      "در تلگرام ربات را باز کن، /start بزن. سپس از اپ، یک کد ۶ رقمی برای یک مخاطب تولید کن و در ربات با /link <code> آن را وارد کن.",
  },
];

export const SCHEMA_SQL = `-- ============================================================
-- دفتر حسابداری — Schema نسخه ۰.۱
-- اجرا در: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ۱. profiles — اطلاعات کاربر (expand auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  default_currency text not null default 'IRT' check (default_currency in ('IRT','IRR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- ۲. ledgers — دفتر شخصی
create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  default_currency text not null default 'IRT' check (default_currency in ('IRT','IRR')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.ledgers enable row level security;
create policy "ledgers_owner_all" on public.ledgers
  for all using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- ۳. contacts — طرف حساب
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  display_name text not null,
  notes text,
  linked_telegram_id bigint,
  linked_profile_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.contacts enable row level security;
create policy "contacts_select_own" on public.contacts for select using (
  exists (select 1 from public.ledgers l where l.id = contacts.ledger_id and l.owner_user_id = auth.uid())
);
create policy "contacts_insert_own" on public.contacts for insert with check (
  exists (select 1 from public.ledgers l where l.id = contacts.ledger_id and l.owner_user_id = auth.uid())
);
create policy "contacts_update_own" on public.contacts for update using (
  exists (select 1 from public.ledgers l where l.id = contacts.ledger_id and l.owner_user_id = auth.uid())
);
create policy "contacts_delete_own" on public.contacts for delete using (
  exists (select 1 from public.ledgers l where l.id = contacts.ledger_id and l.owner_user_id = auth.uid())
);

-- ۴. categories — سرفصل
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
alter table public.categories enable row level security;
create policy "categories_select_own" on public.categories for select using (
  exists (select 1 from public.ledgers l where l.id = categories.ledger_id and l.owner_user_id = auth.uid())
);
create policy "categories_insert_own" on public.categories for insert with check (
  exists (select 1 from public.ledgers l where l.id = categories.ledger_id and l.owner_user_id = auth.uid())
);
create policy "categories_update_own" on public.categories for update using (
  exists (select 1 from public.ledgers l where l.id = categories.ledger_id and l.owner_user_id = auth.uid())
);
create policy "categories_delete_own" on public.categories for delete using (
  exists (select 1 from public.ledgers l where l.id = categories.ledger_id and l.owner_user_id = auth.uid())
);

-- ۵. transactions — تراکنش مالی (حساس)
create type transaction_type as enum (
  'OPENING_RECEIVABLE','OPENING_PAYABLE',
  'RECEIVABLE_CHARGE','PAYABLE_CHARGE',
  'RECEIPT_ALLOCATION','PAYMENT_ALLOCATION'
);
create type transaction_status as enum ('POSTED','REVERSED');

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  category_id uuid references public.categories(id),
  transaction_type transaction_type not null,
  amount bigint not null check (amount > 0),
  currency text not null check (currency in ('IRT','IRR')),
  effective_at date not null,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  description text,
  status transaction_status not null default 'POSTED',
  reverses_transaction_id uuid references public.transactions(id),
  idempotency_key text not null,
  unique (ledger_id, idempotency_key)
);
alter table public.transactions enable row level security;
-- کاربر می‌تواند فقط SELECT تراکنش‌های دفتر خودش را ببیند
create policy "transactions_select_own" on public.transactions for select using (
  exists (select 1 from public.ledgers l where l.id = transactions.ledger_id and l.owner_user_id = auth.uid())
);
-- توجه: INSERT/UPDATE/DELETE غیرممکن است برای کاربران عادی.
-- این عملیات‌ها فقط از طریق Edge Function با service_role (که RLS را دور می‌زند) انجام می‌شود.

-- ۶. audit_logs — گزارش ممیزی
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  result text not null check (result in ('success','failure')),
  details text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
create policy "audit_logs_select_own" on public.audit_logs
  for select using (actor_id = auth.uid());

-- ۷. telegram_links — اتصال تلگرام
create table if not exists public.telegram_links (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  telegram_user_id bigint,
  telegram_username text,
  status text not null default 'pending' check (status in ('pending','linked','revoked')),
  scope text not null default 'balance_only'
    check (scope in ('balance_only','transaction_list','transaction_details','category_breakdown')),
  linked_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.telegram_links enable row level security;
create policy "telegram_links_owner_all" on public.telegram_links
  for all using (
    exists (select 1 from public.ledgers l where l.id = telegram_links.ledger_id and l.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.ledgers l where l.id = telegram_links.ledger_id and l.owner_user_id = auth.uid())
  );

-- ۸. link_codes — کد یک‌بارمصرف اتصال
create table if not exists public.link_codes (
  code text primary key,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  scope text not null default 'balance_only',
  expires_at timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.link_codes enable row level security;
create policy "link_codes_owner_all" on public.link_codes
  for all using (
    exists (select 1 from public.ledgers l where l.id = link_codes.ledger_id and l.owner_user_id = auth.uid())
  ) with check (
    exists (select 1 from public.ledgers l where l.id = link_codes.ledger_id and l.owner_user_id = auth.uid())
  );

-- ۹. ایندکس‌ها
create index if not exists idx_ledgers_owner on public.ledgers(owner_user_id);
create index if not exists idx_contacts_ledger on public.contacts(ledger_id);
create index if not exists idx_categories_ledger on public.categories(ledger_id);
create index if not exists idx_transactions_ledger on public.transactions(ledger_id);
create index if not exists idx_transactions_contact on public.transactions(contact_id);
create index if not exists idx_transactions_effective on public.transactions(effective_at desc);
create index if not exists idx_audit_logs_actor on public.audit_logs(actor_id, created_at desc);
create index if not exists idx_telegram_links_contact on public.telegram_links(contact_id);

-- ۱۰. Trigger: ساخت خودکار profile + ledger هنگام ثبت‌نام
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'کاربر جدید'))
  on conflict (id) do nothing;

  insert into public.ledgers (owner_user_id, name)
  values (new.id, 'دفتر شخصی من')
  on conflict do nothing;

  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ۱۱. Trigger: به‌روزرسانی updated_at برای profiles
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- پایان Schema
`;

export const CREATE_TRANSACTION_FN = `// ============================================================
// Edge Function: create-transaction
// مسیر فایل در پروژه: supabase/functions/create-transaction/index.ts
// دیپلوی: supabase functions deploy create-transaction --no-verify-jwt
// ============================================================
// این تابع تراکنش مالی را با اعتبارسنجی اتمیک ثبت می‌کند.
// کاربران مستقیماً به جدول transactions INSERT نمی‌کنند — همگی از این تابع می‌گذرند.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const TRANSACTION_EFFECT: Record<string, { receivable: number; payable: number }> = {
  OPENING_RECEIVABLE: { receivable: 1, payable: 0 },
  OPENING_PAYABLE: { receivable: 0, payable: 1 },
  RECEIVABLE_CHARGE: { receivable: 1, payable: 0 },
  PAYABLE_CHARGE: { receivable: 0, payable: 1 },
  RECEIPT_ALLOCATION: { receivable: -1, payable: 0 },
  PAYMENT_ALLOCATION: { receivable: 0, payable: -1 },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// استخراج شناسه کاربر از JWT
// (Supabase هنگام درخواست از سمت کلاینت با verify_jwt=true خودکار تأیید می‌کند،
//  ولی چون این تابع را با --no-verify-jwt دیپلوی می‌کنیم، خودمان payload را استخراج می‌کنیم)
function extractUser(jwt: string): { sub: string } | null {
  try {
    const parts = jwt.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.sub) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

async function computeOutstanding(
  supabase: ReturnType<typeof createClient>,
  contactId: string,
  currency: string
): Promise<{ receivable: number; payable: number }> {
  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount")
    .eq("contact_id", contactId)
    .eq("status", "POSTED")
    .eq("currency", currency);

  if (error) throw error;

  let receivable = 0;
  let payable = 0;
  for (const t of data ?? []) {
    const effect = TRANSACTION_EFFECT[t.transaction_type];
    if (!effect) continue;
    receivable += effect.receivable * t.amount;
    payable += effect.payable * t.amount;
  }
  return { receivable, payable };
}

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  result: "success" | "failure",
  details: string,
  entityId: string
) {
  await supabase.from("audit_logs").insert({
    actor_id: userId,
    action: "CREATE_TXN",
    entity_type: "Transaction",
    entity_id: entityId,
    result,
    details,
  });
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
  if (!user) {
    return json({ error: "Invalid token" }, 401);
  }

  let input: {
    contactId: string;
    categoryId?: string | null;
    transactionType: keyof typeof TRANSACTION_EFFECT;
    amount: number;
    currency: "IRT" | "IRR";
    effectiveAt: string;
    description?: string;
    idempotencyKey: string;
  };
  try {
    input = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (
    !input.contactId ||
    !input.transactionType ||
    !input.amount ||
    !input.currency ||
    !input.effectiveAt ||
    !input.idempotencyKey
  ) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (input.amount <= 0) {
    return json({ error: "Amount must be positive" }, 400);
  }
  if (!TRANSACTION_EFFECT[input.transactionType]) {
    return json({ error: "Invalid transaction type" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ۱. تأیید مالکیت: کاربر مالک دفتر این مخاطب است
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, ledger_id, display_name, ledgers(id, owner_user_id)")
    .eq("id", input.contactId)
    .single();

  if (!contact) {
    await logAudit(supabase, user.sub, "failure", "Contact not found", "-");
    return json({ error: "Contact not found" }, 404);
  }
  const ledger = (contact.ledgers as Array<{ id: string; owner_user_id: string }>)[0];
  if (!ledger || ledger.owner_user_id !== user.sub) {
    await logAudit(supabase, user.sub, "failure", "Not authorized", "-");
    return json({ error: "Not authorized" }, 403);
  }

  // ۲. Idempotency: اگر همین تراکنش قبلاً ثبت شده، همان را برگردان
  const { data: existing } = await supabase
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledger.id)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing) {
    return json({ ok: true, transaction: existing, idempotent: true });
  }

  // ۳. اعتبارسنجی مالی: بیش‌پرداخت (overpayment) را مدیریت کن
  // اگر receipt > طلب باز: مابه‌التفاوت به‌عنوان بدهی جدید ثبت می‌شود
  // اگر payment > بدهی باز: مابه‌التفاوت به‌عنوان طلب جدید ثبت می‌شود
  let mainAmount = input.amount;
  let overpayAmount = 0;
  let overpayType: string | null = null;

  if (input.transactionType === "RECEIPT_ALLOCATION") {
    const balance = await computeOutstanding(supabase, input.contactId, input.currency);
    if (input.amount > balance.receivable && balance.receivable > 0) {
      mainAmount = balance.receivable;
      overpayAmount = input.amount - balance.receivable;
      overpayType = "PAYABLE_CHARGE";
    } else if (input.amount > balance.receivable && balance.receivable === 0) {
      overpayAmount = input.amount;
      overpayType = "PAYABLE_CHARGE";
      mainAmount = 0;
    }
  } else if (input.transactionType === "PAYMENT_ALLOCATION") {
    const balance = await computeOutstanding(supabase, input.contactId, input.currency);
    if (input.amount > balance.payable && balance.payable > 0) {
      mainAmount = balance.payable;
      overpayAmount = input.amount - balance.payable;
      overpayType = "RECEIVABLE_CHARGE";
    } else if (input.amount > balance.payable && balance.payable === 0) {
      overpayAmount = input.amount;
      overpayType = "RECEIVABLE_CHARGE";
      mainAmount = 0;
    }
  }

  // ۴. ثبت تراکنش اصلی (اگر mainAmount > 0)
  let mainTxn: any = null;
  if (mainAmount > 0) {
    const { data: txn, error: insertErr } = await supabase
      .from("transactions")
      .insert({
        ledger_id: ledger.id,
        contact_id: input.contactId,
        category_id: input.categoryId ?? null,
        transaction_type: input.transactionType,
        amount: mainAmount,
        currency: input.currency,
        effective_at: input.effectiveAt,
        created_by: user.sub,
        description: input.description ?? null,
        status: "POSTED",
        idempotency_key: input.idempotencyKey,
      })
      .select()
      .single();
    if (insertErr || !txn) {
      const msg = "Insert main failed: " + (insertErr?.message ?? "unknown");
      await logAudit(supabase, user.sub, "failure", msg, "-");
      return json({ error: msg }, 500);
    }
    mainTxn = txn;
    await logAudit(
      supabase, user.sub, "success",
      "Created " + input.transactionType + " " + mainAmount + " " + input.currency + " for " + contact.display_name,
      mainTxn.id
    );
  }

  // ۵. ثبت تراکنش بیش‌پرداخت (اگر هست)
  let overpayTxn: any = null;
  if (overpayAmount > 0 && overpayType) {
    const overpayIdemKey = input.idempotencyKey + "-overpay";
    const overpayDesc = (input.description ?? "") + " (بیش‌پرداخت به‌عنوان " + (overpayType === "PAYABLE_CHARGE" ? "بدهی" : "طلب") + ")";
    const { data: txn2, error: insertErr2 } = await supabase
      .from("transactions")
      .insert({
        ledger_id: ledger.id,
        contact_id: input.contactId,
        category_id: input.categoryId ?? null,
        transaction_type: overpayType,
        amount: overpayAmount,
        currency: input.currency,
        effective_at: input.effectiveAt,
        created_by: user.sub,
        description: overpayDesc,
        status: "POSTED",
        idempotency_key: overpayIdemKey,
      })
      .select()
      .single();
    if (insertErr2 || !txn2) {
      const msg = "Insert overpay failed: " + (insertErr2?.message ?? "unknown");
      await logAudit(supabase, user.sub, "failure", msg, "-");
      return json({ error: msg }, 500);
    }
    overpayTxn = txn2;
    await logAudit(
      supabase, user.sub, "success",
      "Created overpay " + overpayType + " " + overpayAmount + " " + input.currency + " for " + contact.display_name,
      overpayTxn.id
    );
  }

  // ۶. پاسخ
  return json({
    ok: true,
    transaction: mainTxn,
    overpayTransaction: overpayTxn,
    mainAmount,
    overpayAmount,
    overpayType,
  });
});
`;

export const TELEGRAM_BOT_FN = `// ============================================================
// Edge Function: telegram-bot
// مسیر فایل: supabase/functions/telegram-bot/index.ts
// دیپلوی: supabase functions deploy telegram-bot --no-verify-jwt
// تنظیم webhook:
//   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<project>.supabase.co/functions/v1/telegram-bot"
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TELEGRAM_API = "https://api.telegram.org/bot" + BOT_TOKEN;

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

async function tg(chatId: number, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(TELEGRAM_API + "/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function scopeLabel(scope: string): string {
  switch (scope) {
    case "balance_only": return "فقط مانده";
    case "transaction_list": return "فهرست تراکنش‌ها";
    case "transaction_details": return "جزئیات تراکنش‌ها";
    case "category_breakdown": return "گزارش سرفصلی";
    default: return scope;
  }
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function computeBalance(txns: Array<{ transaction_type: string; amount: number }>) {
  let receivable = 0;
  let payable = 0;
  for (const t of txns) {
    if (t.transaction_type === "RECEIVABLE_CHARGE" || t.transaction_type === "OPENING_RECEIVABLE") {
      receivable += t.amount;
    } else if (t.transaction_type === "PAYABLE_CHARGE" || t.transaction_type === "OPENING_PAYABLE") {
      payable += t.amount;
    } else if (t.transaction_type === "RECEIPT_ALLOCATION") {
      receivable -= t.amount;
    } else if (t.transaction_type === "PAYMENT_ALLOCATION") {
      payable -= t.amount;
    }
  }
  return { receivable, payable };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let update: {
    message?: {
      chat?: { id: number };
      text?: string;
      from?: { id: number; username?: string };
    };
  };
  try {
    update = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const message = update.message;
  if (!message || !message.chat || !message.from) return json({ ok: true });
  const chatId = message.chat.id;
  const text = (message.text ?? "").trim();
  const telegramUserId = message.from.id;
  const telegramUsername = message.from.username;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    if (text === "/start") {
      await tg(
        chatId,
        "👋 سلام!\\n\\n" +
          "این ربات برای مشاهده مانده بدهی و طلب شماست.\\n" +
          "برای اتصال، کد ۶ رقمی که از صاحب دفتر گرفته‌اید را بفرستید:\\n" +
          "<code>/link 123456</code>\\n\\n" +
          "بعد از اتصال: <code>/balance</code> برای مشاهده مانده."
      );
      return json({ ok: true });
    }

    if (text.startsWith("/link ")) {
      const code = text.replace("/link ", "").trim();
      if (!/^\\d{6}$/.test(code)) {
        await tg(chatId, "❌ کد باید ۶ رقم باشد. مثال: <code>/link 123456</code>");
        return json({ ok: true });
      }
      const { data: linkCode } = await supabase
        .from("link_codes")
        .select("*")
        .eq("code", code)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!linkCode) {
        await tg(chatId, "❌ کد نامعتبر، منقضی یا قبلاً استفاده شده است.");
        return json({ ok: true });
      }
      const { data: contact } = await supabase
        .from("contacts")
        .select("id, display_name, ledger_id")
        .eq("id", linkCode.contact_id)
        .single();
      if (!contact) {
        await tg(chatId, "❌ مخاطب مرتبط پیدا نشد.");
        return json({ ok: true });
      }
      // علامت‌گذاری کد به‌عنوان استفاده‌شده
      await supabase
        .from("link_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("code", code);
      // درج رابطه تلگرام
      await supabase.from("telegram_links").insert({
        contact_id: contact.id,
        ledger_id: contact.ledger_id,
        telegram_user_id: telegramUserId,
        telegram_username: telegramUsername ? "@" + telegramUsername : null,
        status: "linked",
        scope: linkCode.scope,
        linked_at: new Date().toISOString(),
      });
      // به‌روزرسانی مخاطب
      await supabase
        .from("contacts")
        .update({ linked_telegram_id: telegramUserId })
        .eq("id", contact.id);
      await tg(
        chatId,
        "✅ اتصال موفق بود!\\n\\n" +
          "شما به دفتر متصل شدید.\\n" +
          "نام طرف حساب: " + contact.display_name + "\\n" +
          "سطح دسترسی: " + scopeLabel(linkCode.scope) + "\\n\\n" +
          "حالا با <code>/balance</code> مانده خود را ببینید."
      );
      return json({ ok: true });
    }

    if (text === "/balance" || text === "/transactions") {
      const { data: link } = await supabase
        .from("telegram_links")
        .select("contact_id, scope")
        .eq("telegram_user_id", telegramUserId)
        .eq("status", "linked")
        .maybeSingle();
      if (!link) {
        await tg(chatId, "❌ حساب شما متصل نیست. با <code>/link 123456</code> اتصال دهید.");
        return json({ ok: true });
      }
      const { data: txns } = await supabase
        .from("transactions")
        .select("transaction_type, amount, currency, effective_at, description")
        .eq("contact_id", link.contact_id)
        .eq("status", "POSTED")
        .order("effective_at", { ascending: false });
      const { receivable, payable } = computeBalance(txns ?? []);
      const currency = (txns && txns[0]?.currency) || "IRT";
      const label = currency === "IRT" ? "تومان" : "ریال";
      let msg = "📊 <b>مانده شما</b>\\n\\n";
      msg += "🟢 طلب از شما (به شما بدهکار است): <b>" + fmt(receivable) + "</b> " + label + "\\n";
      msg += "🔴 بدهی شما (به او بدهکارید): <b>" + fmt(payable) + "</b> " + label + "\\n";
      if (text === "/transactions" &&
          (link.scope === "transaction_list" || link.scope === "transaction_details")) {
        msg += "\\n<b>آخرین تراکنش‌ها:</b>\\n";
        for (const t of (txns ?? []).slice(0, 10)) {
          msg += "• " + t.effective_at + " | " + t.transaction_type + " | " + fmt(t.amount) + " " + label;
          if (t.description) msg += " | " + t.description;
          msg += "\\n";
        }
      } else if (text === "/transactions") {
        msg += "\\n⚠️ سطح دسترسی شما اجازه مشاهده تراکنش‌ها را نمی‌دهد.";
      } else {
        msg += "\\nبرای مشاهده تراکنش‌ها (اگر مجاز باشد): <code>/transactions</code>";
      }
      await tg(chatId, msg);
      return json({ ok: true });
    }

    if (text === "/help") {
      await tg(
        chatId,
        "📖 <b>دستورها</b>\\n\\n" +
          "• <code>/start</code> — شروع\\n" +
          "• <code>/link 123456</code> — اتصال با کد\\n" +
          "• <code>/balance</code> — مشاهده مانده\\n" +
          "• <code>/transactions</code> — فهرست تراکنش‌ها (اگر مجاز باشد)\\n" +
          "• <code>/help</code> — این پیام"
      );
      return json({ ok: true });
    }

    await tg(
      chatId,
      "❓ دستور نامشخص. <code>/help</code> را بزن."
    );
    return json({ ok: true });
  } catch (e) {
    console.error("Bot error:", e);
    await tg(chatId, "⚠️ خطای سرور. بعداً تلاش کنید.");
    return json({ ok: true });
  }
});
`;

// ============================================================
// Edge Function: admin-users
// مدیریت کاربران (ساخت، لیست، حذف) — فقط admin
// مسیر: supabase/functions/admin-users/index.ts
// دیپلوی: supabase functions deploy admin-users --no-verify-jwt
// ============================================================

export const ADMIN_USERS_FN = `// Edge Function: admin-users
// مدیریت کاربران — فقط admin (صاحب دفتر) می‌تواند استفاده کند
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
  // admin یعنی صاحب دفتری باشد که owner_user_id === خودش
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

  // فقط admin می‌تواند استفاده کند
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
    // audit log
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

  // DELETE: حذف کاربر (با user_id در query)
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

  return json({ error: "Method not allowed" }, 405);
});
`;

// ============================================================
// Edge Function: admin-backup
// export همه داده‌ها به JSON — فقط admin
// مسیر: supabase/functions/admin-backup/index.ts
// دیپلوی: supabase functions deploy admin-backup --no-verify-jwt
// ============================================================

export const ADMIN_BACKUP_FN = `// Edge Function: admin-backup
// export همه جداول به JSON — فقط admin
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

  // export همه جداول (فقط دیتای این admin — یعنی ledgers که owner_user_id === user.sub)
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

  // audit
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
`;

// ============================================================
// Edge Function: admin-restore
// import JSON backup — فقط admin
// مسیر: supabase/functions/admin-restore/index.ts
// دیپلوی: supabase functions deploy admin-restore --no-verify-jwt
// ============================================================

export const ADMIN_RESTORE_FN = `// Edge Function: admin-restore
// import داده‌ها از JSON backup — فقط admin
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

  // فقط داده‌های این admin (با همان user_id) را restore کن
  const stats = { contacts: 0, categories: 0, transactions: 0, telegram_links: 0, link_codes: 0 };

  // برای هر ledger در backup، اگر owner_user_id با user.sub مطابقت دارد، restore کن
  const validLedgerIds: string[] = [];
  for (const l of backup.ledgers) {
    if (l.owner_user_id === user.sub) {
      validLedgerIds.push(l.id);
      // upsert ledger
      await supabase.from("ledgers").upsert(l);
    }
  }

  if (validLedgerIds.length === 0) {
    return json({ error: "No valid ledgers in backup for this admin" }, 400);
  }

  // contacts
  if (Array.isArray(backup.contacts)) {
    const validContacts = backup.contacts.filter((c: any) => validLedgerIds.includes(c.ledger_id));
    if (validContacts.length > 0) {
      const { data, error } = await supabase.from("contacts").upsert(validContacts);
      if (!error) stats.contacts = validContacts.length;
    }
  }
  // categories
  if (Array.isArray(backup.categories)) {
    const valid = backup.categories.filter((c: any) => validLedgerIds.includes(c.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("categories").upsert(valid);
      if (!error) stats.categories = valid.length;
    }
  }
  // transactions
  if (Array.isArray(backup.transactions)) {
    const valid = backup.transactions.filter((t: any) => validLedgerIds.includes(t.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("transactions").upsert(valid);
      if (!error) stats.transactions = valid.length;
    }
  }
  // telegram_links
  if (Array.isArray(backup.telegram_links)) {
    const valid = backup.telegram_links.filter((t: any) => validLedgerIds.includes(t.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("telegram_links").upsert(valid);
      if (!error) stats.telegram_links = valid.length;
    }
  }
  // link_codes
  if (Array.isArray(backup.link_codes)) {
    const valid = backup.link_codes.filter((l: any) => validLedgerIds.includes(l.ledger_id));
    if (valid.length > 0) {
      const { error } = await supabase.from("link_codes").upsert(valid);
      if (!error) stats.link_codes = valid.length;
    }
  }

  // audit
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
`;

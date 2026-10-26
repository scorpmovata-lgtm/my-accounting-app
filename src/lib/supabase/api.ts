// لایه API اتصال به Supabase — تمام عملیات دیتابیس از این فایل می‌گذرد
// این توابع فقط در کلاینت قابل اجرا هستند (به localhost و window دسترسی دارند)

import {
  AuditLogEntry,
  Category,
  Contact,
  Currency,
  Ledger,
  TelegramAccessScope,
  TelegramLink,
  Transaction,
  TransactionType,
} from "@/lib/accounting/types";
import {
  getSupabaseClient,
  getSupabaseConfig,
  SupabaseConfig,
} from "@/lib/supabase/client";

// ============================================================
// کمکی‌ها
// ============================================================

/**
 * ترجمه پیام‌های خطای Supabase Auth به فارسی.
 * کاربر Persian-speaking است و نباید با پیام انگلیسی مواجه شود.
 */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "ایمیل یا رمز عبور نادرست است.";
  }
  if (m.includes("email not confirmed")) {
    return "ایمیل شما هنوز تأیید نشده است.";
  }
  if (m.includes("user already registered")) {
    return "این ایمیل قبلاً ثبت شده است.";
  }
  if (m.includes("password should be at least")) {
    return "رمز عبور باید حداقل ۶ کاراکتر باشد.";
  }
  if (m.includes("rate limit")) {
    return "تلاش‌های زیادی انجام شده — کمی صبر کنید و دوباره امتحان کنید.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "خطای شبکه — اتصال اینترنت یا URL پروژه Supabase را بررسی کنید.";
  }
  if (m.includes("jwt expired") || m.includes("token")) {
    return "نشست شما منقضی شده — دوباره وارد شوید.";
  }
  // پیش‌فرض: همان پیام اصلی (در صورت عدم تطابق)
  return message;
}

/** دریافت access_token فعلی از session کاربر. */
async function getAccessToken(): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session?.access_token ?? null;
}

/** ساخت URL پایه برای Edge Function‌ها. */
function getFunctionsBase(): string | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  // حذف اسلش انتهایی برای جلوگیری از //
  return config.url.replace(/\/$/, "");
}

// ============================================================
// بخش ۱: احراز هویت
// ============================================================

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error("ابتدا تنظیمات Supabase را وارد کنید.");
  }
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(translateAuthError(error.message));
  }
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getCurrentSession(): Promise<{
  userId: string;
  email: string | null;
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  if (!data.session) return null;
  return {
    userId: data.session.user.id,
    email: data.session.user.email ?? null,
  };
}

// ============================================================
// بخش ۲: خواندن داده
// ============================================================

export async function fetchUserProfile(): Promise<{
  displayName: string;
  defaultCurrency: Currency;
} | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) return null;
  const userId = sessionData.session.user.id;
  const { data, error } = await client
    .from("profiles")
    .select("display_name, default_currency")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.error("fetchUserProfile error:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    displayName: data.display_name ?? "کاربر",
    defaultCurrency: (data.default_currency as Currency) ?? "IRT",
  };
}

export async function fetchLedgerId(userId: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from("ledgers")
    .select("id, name, default_currency, created_at")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    console.error("fetchLedgerId error:", error.message);
    return null;
  }
  return data?.id ?? null;
}

export async function fetchLedger(userId: string): Promise<Ledger | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from("ledgers")
    .select("id, name, default_currency, created_at")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    console.error("fetchLedger error:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    ownerName: "", // به‌روزرسانی توسط فراخواننده
    name: data.name,
    defaultCurrency: data.default_currency as Currency,
    createdAt: data.created_at,
  };
}

export async function fetchLedgerById(ledgerId: string): Promise<Ledger | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from("ledgers")
    .select("id, name, default_currency, created_at")
    .eq("id", ledgerId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) {
    console.error("fetchLedgerById error:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    ownerName: "",
    name: data.name,
    defaultCurrency: data.default_currency as Currency,
    createdAt: data.created_at,
  };
}

export async function fetchContacts(ledgerId: string): Promise<Contact[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("contacts")
    .select("id, ledger_id, display_name, notes, linked_telegram_id, linked_profile_id, created_at, archived_at")
    .eq("ledger_id", ledgerId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("fetchContacts error:", error.message);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    ledgerId: c.ledger_id,
    displayName: c.display_name,
    notes: c.notes ?? undefined,
    linkedTelegramId: c.linked_telegram_id?.toString() ?? null,
    linkedProfileId: c.linked_profile_id ?? null,
    createdAt: c.created_at,
    archivedAt: c.archived_at ?? null,
  }));
}

export async function fetchCategories(ledgerId: string): Promise<Category[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("categories")
    .select("id, ledger_id, name, is_active, sort_order, created_at, archived_at")
    .eq("ledger_id", ledgerId)
    .order("sort_order", { ascending: true });
  if (error) {
    console.error("fetchCategories error:", error.message);
    return [];
  }
  return (data ?? []).map((c) => ({
    id: c.id,
    ledgerId: c.ledger_id,
    name: c.name,
    isActive: c.is_active,
    sortOrder: c.sort_order,
    createdAt: c.created_at,
    archivedAt: c.archived_at ?? null,
  }));
}

export async function fetchTransactions(
  ledgerId: string
): Promise<Transaction[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("transactions")
    .select(
      "id, ledger_id, contact_id, category_id, transaction_type, amount, currency, effective_at, created_at, created_by, description, status, reverses_transaction_id, idempotency_key"
    )
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchTransactions error:", error.message);
    return [];
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    ledgerId: t.ledger_id,
    contactId: t.contact_id,
    categoryId: t.category_id ?? null,
    transactionType: t.transaction_type as TransactionType,
    amount: Number(t.amount),
    currency: t.currency as Currency,
    effectiveAt: t.effective_at,
    createdAt: t.created_at,
    createdBy: t.created_by,
    description: t.description ?? undefined,
    status: t.status as "POSTED" | "REVERSED",
    reversesTransactionId: t.reverses_transaction_id ?? null,
    idempotencyKey: t.idempotency_key,
  }));
}

export async function fetchAuditLogs(
  ledgerId: string
): Promise<AuditLogEntry[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) return [];
  const { data, error } = await client
    .from("audit_logs")
    .select("id, actor_id, action, entity_type, entity_id, result, details, created_at")
    .eq("actor_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("fetchAuditLogs error:", error.message);
    return [];
  }
  void ledgerId; // پارامتر برای سازگاری API — فیلتر بر اساس userId است
  return (data ?? []).map((a) => ({
    id: a.id,
    actorId: a.actor_id ?? "—",
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    result: a.result as "success" | "failure",
    details: a.details ?? undefined,
    createdAt: a.created_at,
  }));
}

export async function fetchTelegramLinks(
  ledgerId: string
): Promise<TelegramLink[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const { data, error } = await client
    .from("telegram_links")
    .select(
      "id, contact_id, ledger_id, telegram_user_id, telegram_username, status, scope, linked_at, revoked_at, created_at"
    )
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("fetchTelegramLinks error:", error.message);
    return [];
  }
  return (data ?? []).map((l) => ({
    id: l.id,
    contactId: l.contact_id,
    telegramUserId: l.telegram_user_id?.toString() ?? null,
    telegramUsername: l.telegram_username ?? null,
    status: l.status as "pending" | "linked" | "revoked",
    scope: l.scope as TelegramAccessScope,
    linkedAt: l.linked_at ?? null,
    revokedAt: l.revoked_at ?? null,
    createdAt: l.created_at,
  }));
}

// ============================================================
// بخش ۳: Mutations (عملیات نوشتن)
// ============================================================

export interface AddTransactionInput {
  contactId: string;
  categoryId?: string | null;
  transactionType: TransactionType;
  amount: number;
  currency: Currency;
  effectiveAt: string;
  description?: string;
}

/**
 * ثبت تراکنش از طریق Edge Function create-transaction.
 * کاربران مستقیماً به جدول transactions INSERT نمی‌کنند (RLS ممنوع کرده).
 * این تابع با JWT کاربر، Edge Function را فرا می‌خواند و آن با service_role ثبت می‌کند.
 *
 * پاسخ موفق: { ok: true, transaction: Transaction }
 * پاسخ خطا: { ok: false, error: string }
 */
export async function addTransactionViaEdgeFunction(
  input: AddTransactionInput
): Promise<{ ok: boolean; error?: string; transaction?: Transaction }> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) {
    return {
      ok: false,
      error: "ابتدا وارد شوید.",
    };
  }
  // کلید idempotency یکتا برای این درخواست
  const idempotencyKey = `web-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  // توجه: Edge Function از camelCase استفاده می‌کند (نه snake_case)
  const payload = {
    contactId: input.contactId,
    categoryId: input.categoryId ?? null,
    transactionType: input.transactionType,
    amount: input.amount,
    currency: input.currency,
    effectiveAt: input.effectiveAt,
    description: input.description ?? null,
    idempotencyKey,
    allowOverpay: input.allowOverpay ?? false,
  };
  try {
    const res = await fetch(`${base}/functions/v1/create-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? "خطای ناشناخته" };
    }
    if (!data.ok) {
      return { ok: false, error: data.error ?? "خطای ناشناخته" };
    }
    // داده تراکنش برگشتی از Edge Function
    const tx = data.transaction;
    if (!tx) {
      return { ok: true };
    }
    const transaction: Transaction = {
      id: tx.id,
      ledgerId: tx.ledger_id,
      contactId: tx.contact_id,
      categoryId: tx.category_id ?? null,
      transactionType: tx.transaction_type as TransactionType,
      amount: Number(tx.amount),
      currency: tx.currency as Currency,
      effectiveAt: tx.effective_at,
      createdAt: tx.created_at,
      createdBy: tx.created_by,
      description: tx.description ?? undefined,
      status: tx.status as "POSTED" | "REVERSED",
      reversesTransactionId: tx.reverses_transaction_id ?? null,
      idempotencyKey: tx.idempotency_key,
    };
    return { ok: true, transaction };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? `خطای شبکه: ${e.message}`
          : "خطای شبکه هنگام ثبت تراکنش",
    };
  }
}

export async function addContactToSupabase(
  ledgerId: string,
  name: string,
  notes?: string
): Promise<Contact | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data, error } = await client
    .from("contacts")
    .insert({
      ledger_id: ledgerId,
      display_name: name.trim(),
      notes: notes?.trim() || null,
    })
    .select(
      "id, ledger_id, display_name, notes, linked_telegram_id, linked_profile_id, created_at, archived_at"
    )
    .single();
  if (error) {
    console.error("addContactToSupabase error:", error.message);
    return null;
  }
  return {
    id: data.id,
    ledgerId: data.ledger_id,
    displayName: data.display_name,
    notes: data.notes ?? undefined,
    linkedTelegramId: data.linked_telegram_id?.toString() ?? null,
    linkedProfileId: data.linked_profile_id ?? null,
    createdAt: data.created_at,
    archivedAt: data.archived_at ?? null,
  };
}

export async function addCategoryToSupabase(
  ledgerId: string,
  name: string
): Promise<Category | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  // یافتن sort_order بعدی
  const { data: existing } = await client
    .from("categories")
    .select("sort_order")
    .eq("ledger_id", ledgerId)
    .order("sort_order", { ascending: false })
    .limit(1);
  const nextSort = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1;
  const { data, error } = await client
    .from("categories")
    .insert({
      ledger_id: ledgerId,
      name: name.trim(),
      sort_order: nextSort,
    })
    .select(
      "id, ledger_id, name, is_active, sort_order, created_at, archived_at"
    )
    .single();
  if (error) {
    console.error("addCategoryToSupabase error:", error.message);
    return null;
  }
  return {
    id: data.id,
    ledgerId: data.ledger_id,
    name: data.name,
    isActive: data.is_active,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    archivedAt: data.archived_at ?? null,
  };
}

export async function generateLinkCodeInSupabase(
  ledgerId: string,
  contactId: string,
  scope: TelegramAccessScope
): Promise<{ code: string; expiresAt: string } | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  // کد ۶ رقمی یکتا
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  // انقضا ۱۰ دقیقه
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await client.from("link_codes").insert({
    code,
    contact_id: contactId,
    ledger_id: ledgerId,
    scope,
    expires_at: expiresAt,
    used: false,
  });
  if (error) {
    console.error("generateLinkCodeInSupabase error:", error.message);
    return null;
  }
  return { code, expiresAt };
}

export async function revokeTelegramLinkInSupabase(
  linkId: string
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { error } = await client
    .from("telegram_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) {
    console.error("revokeTelegramLinkInSupabase error:", error.message);
    return false;
  }
  return true;
}

// ============================================================
// بخش ۴: عملیات ادمین (Edge Functions با service_role)
// ============================================================

export interface AdminUser {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
}

export async function adminListUsers(): Promise<AdminUser[]> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) return [];
  try {
    const res = await fetch(`${base}/functions/v1/admin-users`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const users = data.users ?? [];
    return users.map((u: {
      id: string;
      email?: string | null;
      display_name?: string | null;
      created_at?: string;
      last_sign_in_at?: string | null;
      email_confirmed?: boolean;
    }) => ({
      id: u.id,
      email: u.email ?? null,
      displayName: u.display_name ?? null,
      createdAt: u.created_at ?? new Date().toISOString(),
      lastSignInAt: u.last_sign_in_at ?? null,
      emailConfirmed: !!u.email_confirmed,
    }));
  } catch (e) {
    console.error("adminListUsers error:", e);
    return [];
  }
}

export async function adminCreateUser(input: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<{ ok: boolean; error?: string; user?: AdminUser }> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  try {
    const res = await fetch(`${base}/functions/v1/admin-users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        display_name: input.displayName,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "خطا در ساخت کاربر" };
    }
    return {
      ok: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.display_name,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
        emailConfirmed: true,
      },
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "خطای شبکه",
    };
  }
}

export async function adminDeleteUser(userId: string): Promise<boolean> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) return false;
  try {
    const res = await fetch(
      `${base}/functions/v1/admin-users?id=${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return res.ok;
  } catch (e) {
    console.error("adminDeleteUser error:", e);
    return false;
  }
}

/**
 * به‌روزرسانی display_name یک کاربر از طریق Edge Function admin-users (PUT).
 * فقط admin (صاحب دفتر) مجاز است.
 */
export async function adminUpdateUser(
  userId: string,
  displayName: string
): Promise<{ ok: boolean; error?: string }> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  try {
    const res = await fetch(
      `${base}/functions/v1/admin-users?id=${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ display_name: displayName }),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error ?? "خطا در به‌روزرسانی کاربر" };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "خطای شبکه",
    };
  }
}

export interface BackupData {
  version: string;
  created_at: string;
  admin_user_id: string;
  ledgers: unknown[];
  profiles: unknown[];
  contacts: unknown[];
  categories: unknown[];
  transactions: unknown[];
  audit_logs: unknown[];
  telegram_links: unknown[];
  link_codes: unknown[];
}

export async function adminBackup(): Promise<BackupData | null> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) return null;
  try {
    const res = await fetch(`${base}/functions/v1/admin-backup`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    return (await res.json()) as BackupData;
  } catch (e) {
    console.error("adminBackup error:", e);
    return null;
  }
}

export async function adminRestore(
  backup: unknown
): Promise<{ ok: boolean; error?: string; stats?: unknown }> {
  const base = getFunctionsBase();
  const token = await getAccessToken();
  if (!base || !token) {
    return { ok: false, error: "ابتدا وارد شوید." };
  }
  try {
    const res = await fetch(`${base}/functions/v1/admin-restore`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(backup),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error ?? "خطا در بازگردانی" };
    }
    return { ok: true, stats: data.stats };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "خطای شبکه",
    };
  }
}

// Re-export برای راحتی مصرف‌کننده‌ها
export type { SupabaseConfig };

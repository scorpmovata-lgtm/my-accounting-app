// لایه اتصال به Supabase واقعی (real mode) — نسخه ۳.۰
// ============================================================
// فعال‌شدن با متغیرهای محیطی:
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// در ساندباکس تنظیم نشده‌اند → realMode=false → حالت موک.
//
// نسخه ۳: خواندن‌ها با RLS محدود شده‌اند:
//   - counterparties: فقط مشترک‌هایِ مجاز + شخصی خودم
//   - transactions: دفتر خودم + تراکنش‌هایی که دیگران درباره من ثبت کرده‌اند
//   - categories/comments/grants: طبق RLS
// نوشتن تراکنش/مدیریت از طریق Edge Function (service_role) و بقیه با RLS مستقیم.
//
// احراز هویت با username: email = username + "@accounting.local"

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  AccessGrant,
  Category,
  Counterparty,
  Transaction,
  TxnComment,
  TxnKind,
  User,
} from "@/lib/accounting/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realMode = !!(SUPABASE_URL && SUPABASE_ANON);

let _client: SupabaseClient | null = null;

export function getClient(): SupabaseClient | null {
  if (!realMode) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL as string, SUPABASE_ANON as string, {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "accounting_v2_auth",
  });
  return _client;
}

const EF_BASE = SUPABASE_URL
  ? (SUPABASE_URL as string).replace(/\/$/, "") + "/functions/v1"
  : "";

// فراخوانی Edge Function با توکن کاربر
async function callEF(
  name: string,
  method: string,
  body?: unknown,
  params?: Record<string, string>
): Promise<any> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const { data: sessionData } = await c.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("احراز هویت نشده.");
  const url = new URL(EF_BASE + "/" + name);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطای سرور (" + res.status + ")");
  return data;
}

// ترجمه خطاهای Auth
function translateAuthError(m: string): string {
  const low = m.toLowerCase();
  if (low.includes("invalid login credentials"))
    return "نام کاربری یا رمز عبور نادرست است.";
  if (low.includes("email not confirmed"))
    return "ایمیل تأیید نشده است.";
  if (low.includes("rate limit")) return "تلاش‌های زیاد؛ کمی صبر کنید.";
  return m;
}

// ---------------------------------------------------------------------------
// نگاشت ردیف‌های دیتابیس (snake_case) → مدل TypeScript (camelCase)
// ---------------------------------------------------------------------------

function mapUser(r: any): User {
  return {
    id: r.id,
    username: r.username,
    password: "",
    displayName: r.display_name,
    role: r.role,
    scope: r.scope ?? undefined,
    linkedCounterpartyId: r.linked_counterparty_id ?? null,
    isActive: r.is_active !== false,
    createdAt: r.created_at,
  };
}

function mapCounterparty(r: any): Counterparty {
  return {
    id: r.id,
    displayName: r.display_name,
    notes: r.notes ?? undefined,
    linkedUserId: r.linked_user_id ?? null,
    linkedUsername: r.linked_username ?? null,
    isShared: r.is_shared !== false,
    ownerUserId: r.owner_user_id ?? null,
    createdBy: r.created_by,
    createdAt: r.created_at,
    archivedAt: r.archived_at ?? null,
  };
}

function mapTransaction(r: any): Transaction {
  return {
    id: r.id,
    userId: r.user_id,
    counterpartyId: r.counterparty_id,
    kind: r.kind as TxnKind,
    amount: Number(r.amount),
    currency: r.currency,
    effectiveAt: r.effective_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
    description: r.description ?? undefined,
    categoryId: r.category_id ?? null,
    status: r.status,
    idempotencyKey: r.idempotency_key,
  };
}

function mapCategory(r: any): Category {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    createdAt: r.created_at,
    counterpartyId: r.counterparty_id ?? null,
  };
}

function mapComment(r: any): TxnComment {
  return {
    id: r.id,
    transactionId: r.transaction_id,
    authorId: r.author_id,
    authorName: r.author_name,
    body: r.body,
    createdAt: r.created_at,
  };
}

function mapGrant(r: any): AccessGrant {
  return {
    id: r.id,
    userId: r.user_id,
    counterpartyId: r.counterparty_id,
    grantedBy: r.granted_by,
    createdAt: r.created_at,
  };
}

// ---------------------------------------------------------------------------
// احراز هویت
// ---------------------------------------------------------------------------

export async function signInWithUsername(
  username: string,
  password: string,
  rememberMe: boolean = true
): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const email = username.trim().toLowerCase() + "@accounting.local";
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
  // ★ اگر کاربر «مرا به خاطر بسپار» را انتخاب نکرده، نشست را از
  //   localStorage پاک می‌کنیم تا با بستن مرورگر/تب، نشست از بین برود.
  //   در نشست فعلی (in-memory) کاربر لاگ‌این می‌ماند ولی بعد از reload
  //   یا باز کردن مجدد برنامه، صفحه ورود نمایش داده می‌شود.
  //   این رفتار برای جلوگیری از ورود خودکار در موبایل (که نشست‌ها
  //   به‌شدت در localStorage حفظ می‌شوند) ضروری است.
  if (!rememberMe) {
    try {
      // پاک کردن persisted session — auth.getSession هنوز در همان تب
      //   نشست in-memory را برمی‌گرداند، ولی بعد از reload دیگر چیزی نیست.
      const storageKey = "accounting_v2_auth";
      if (typeof localStorage !== "undefined") {
        // Supabase یک کلید با همین نام + یک کلید با prefix "sb-" می‌نویسد
        localStorage.removeItem(storageKey);
        // کلیدهای sb-... را هم پاک می‌کنیم
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith("sb-") || k === storageKey)) {
            localStorage.removeItem(k);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
}

export async function signOutReal(): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.auth.signOut();
}

// بازیابی نشست ذخیره‌شده (برای refresh صفحه) — کاربر غیرفعال رد می‌شود
export async function getCurrentRealUser(): Promise<User | null> {
  const c = getClient();
  if (!c) return null;
  const { data: sessionData } = await c.auth.getSession();
  if (!sessionData.session) return null;
  const uid = sessionData.session.user.id;
  const { data: prof } = await c
    .from("user_profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();
  if (!prof) return null;
  if (prof.is_active === false) {
    await signOutReal();
    throw new Error("حساب کاربری شما توسط مدیر غیرفعال شده است.");
  }
  return mapUser(prof);
}

// ---------------------------------------------------------------------------
// خواندن داده (RLS خودش محدود می‌کند)
// ---------------------------------------------------------------------------

export async function fetchRealUsers(): Promise<User[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("user_profiles")
    .select("*")
    .order("created_at");
  return (data || []).map(mapUser);
}

export async function fetchRealCounterparties(): Promise<Counterparty[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("counterparties")
    .select("*")
    .order("created_at");
  return (data || []).map(mapCounterparty);
}

// دفتر خودم + تراکنش‌هایی که دیگران درباره من ثبت کرده‌اند (RLS)
export async function fetchRealTransactions(): Promise<Transaction[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("transactions")
    .select("*")
    .eq("status", "POSTED")
    .order("created_at", { ascending: false });
  return (data || []).map(mapTransaction);
}

export async function fetchRealCategories(): Promise<Category[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("categories")
    .select("*")
    .order("created_at");
  return (data || []).map(mapCategory);
}

export async function fetchRealComments(): Promise<TxnComment[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("transaction_comments")
    .select("*")
    .order("created_at", { ascending: true });
  return (data || []).map(mapComment);
}

// گرنت‌ها: کاربر فقط خودش را می‌بیند؛ ادمین همه را (RLS)
export async function fetchRealGrants(): Promise<AccessGrant[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("counterparty_access")
    .select("*")
    .order("created_at");
  return (data || []).map(mapGrant);
}

// ---------------------------------------------------------------------------
// دسته‌بندی شخصی (RLS: مالک)
// ---------------------------------------------------------------------------

export async function createCategoryReal(
  name: string,
  counterpartyId?: string | null
): Promise<Category> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const uid = (await c.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("احراز هویت نشده.");
  const { data, error } = await c
    .from("categories")
    .insert({
      user_id: uid,
      name,
      counterparty_id: counterpartyId ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCategory(data);
}

export async function renameCategoryReal(id: string, name: string): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const { error } = await c.from("categories").update({ name }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateCategoryReal(
  id: string,
  patch: { name?: string; counterpartyId?: string | null }
): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const upd: Record<string, unknown> = {};
  if (patch.name !== undefined) upd.name = patch.name;
  if (patch.counterpartyId !== undefined) upd.counterparty_id = patch.counterpartyId;
  if (Object.keys(upd).length === 0) return;
  const { error } = await c.from("categories").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCategoryReal(id: string): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const { error } = await c.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// طرف‌حساب شخصی (RLS: مالک)
// ---------------------------------------------------------------------------

export async function createPrivateCounterpartyReal(
  displayName: string,
  notes?: string
): Promise<Counterparty> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const uid = (await c.auth.getSession()).data.session?.user.id;
  if (!uid) throw new Error("احراز هویت نشده.");
  const { data, error } = await c
    .from("counterparties")
    .insert({
      display_name: displayName,
      notes: notes || null,
      is_shared: false,
      owner_user_id: uid,
      created_by: uid,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapCounterparty(data);
}

export async function deletePrivateCounterpartyReal(id: string): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const { error } = await c.from("counterparties").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// کامنت روی تراکنش (RLS: نویسنده + تراکنش مرئی)
// ---------------------------------------------------------------------------

export async function addCommentReal(
  transactionId: string,
  body: string
): Promise<TxnComment> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const sess = (await c.auth.getSession()).data.session;
  if (!sess) throw new Error("احراز هویت نشده.");
  const authorName =
    (sess.user.user_metadata as any)?.display_name ||
    (sess.user.email || "").split("@")[0] ||
    "کاربر";
  const { data, error } = await c
    .from("transaction_comments")
    .insert({
      transaction_id: transactionId,
      author_id: sess.user.id,
      author_name: authorName,
      body,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapComment(data);
}

// ---------------------------------------------------------------------------
// جهش‌ها (Edge Functions)
// ---------------------------------------------------------------------------

export interface CreateTxnInput {
  kind: TxnKind;
  counterpartyId: string;
  amount: number;
  currency: "IRT" | "IRR";
  effectiveAt: string;
  description?: string;
  categoryId?: string | null;
}

export async function createTransactionReal(
  input: CreateTxnInput
): Promise<{ transaction: Transaction | null }> {
  const res = await callEF("create-transaction", "POST", {
    kind: input.kind,
    counterpartyId: input.counterpartyId,
    amount: input.amount,
    currency: input.currency,
    effectiveAt: input.effectiveAt,
    description: input.description,
    categoryId: input.categoryId ?? null,
    idempotencyKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "idem-" + Date.now(),
  });
  return {
    transaction: res.transaction ? mapTransaction(res.transaction) : null,
  };
}

// ---------------------------------------------------------------------------
// ویرایش و حذف تراکنش (Edge Function manage-transaction)
//   - فقط صاحب دفتر می‌تواند (user_id === auth.uid)
//   - ویرایش: اعتبارسنجی مجدد طرف‌حساب و دسته در EF
//   - حذف: کامنت‌های تراکنش با cascade خودکار حذف می‌شوند
// ---------------------------------------------------------------------------

export interface UpdateTxnInput {
  kind?: TxnKind;
  counterpartyId?: string;
  amount?: number;
  currency?: "IRT" | "IRR";
  effectiveAt?: string;
  description?: string;
  categoryId?: string | null;
}

export async function updateTransactionReal(
  id: string,
  patch: UpdateTxnInput
): Promise<{ transaction: Transaction | null }> {
  const body: Record<string, unknown> = {};
  if (patch.kind !== undefined) body.kind = patch.kind;
  if (patch.counterpartyId !== undefined) body.counterpartyId = patch.counterpartyId;
  if (patch.amount !== undefined) body.amount = patch.amount;
  if (patch.currency !== undefined) body.currency = patch.currency;
  if (patch.effectiveAt !== undefined) body.effectiveAt = patch.effectiveAt;
  if (patch.description !== undefined) body.description = patch.description;
  if (patch.categoryId !== undefined) body.categoryId = patch.categoryId;
  const res = await callEF("manage-transaction", "PUT", body, { id });
  return {
    transaction: res.transaction ? mapTransaction(res.transaction) : null,
  };
}

export async function deleteTransactionReal(id: string): Promise<void> {
  await callEF("manage-transaction", "DELETE", undefined, { id });
}

// ---------------------------------------------------------------------------
// بک‌آپ دستی (ادمین) — فراخوانی EF backup-email با JWT کاربر
// اگر متغیرهای ایمیل تنظیم نشده، فقط داده JSON برمی‌گرداند.
// ---------------------------------------------------------------------------

export interface BackupResult {
  ok: boolean;
  emailSent: boolean;
  recipient?: string;
  filename?: string;
  rowCounts?: Record<string, number>;
  backup?: any;
  message?: string;
  error?: string;
}

export async function triggerBackupEmailReal(): Promise<BackupResult> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const { data: sessionData } = await c.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("احراز هویت نشده.");
  const url = new URL(EF_BASE + "/backup-email");
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطای سرور (" + res.status + ")");
  return data as BackupResult;
}

export async function adminCreateUserReal(input: {
  username: string;
  password: string;
  displayName: string;
  role: "admin" | "user";
  scope?: "balance_only" | "transaction_list";
  makeCounterparty?: boolean;
}): Promise<any> {
  return callEF("admin-users", "POST", input);
}

export async function adminUpdateUserReal(
  id: string,
  patch: {
    displayName?: string;
    password?: string;
    scope?: string;
    isActive?: boolean;
  }
): Promise<any> {
  return callEF("admin-users", "PUT", patch, { id });
}

export async function adminDeleteUserReal(id: string): Promise<any> {
  return callEF("admin-users", "DELETE", undefined, { id });
}

export async function adminCreateCounterpartyReal(input: {
  displayName: string;
  notes?: string;
  linkedUserId?: string | null;
}): Promise<any> {
  return callEF("admin-counterparties", "POST", input);
}

export async function adminUpdateCounterpartyReal(
  id: string,
  patch: { displayName?: string; notes?: string; linkedUserId?: string | null }
): Promise<any> {
  return callEF("admin-counterparties", "PUT", patch, { id });
}

export async function adminDeleteCounterpartyReal(id: string): Promise<any> {
  return callEF("admin-counterparties", "DELETE", undefined, { id });
}

// گرنت دسترسی طرف‌حساب مشترک (ادمین)
export async function adminGrantCpReal(
  userId: string,
  counterpartyId: string
): Promise<any> {
  return callEF("admin-counterparties", "POST", {
    action: "grant",
    userId,
    counterpartyId,
  });
}

export async function adminRevokeCpReal(
  userId: string,
  counterpartyId: string
): Promise<any> {
  return callEF("admin-counterparties", "POST", {
    action: "revoke",
    userId,
    counterpartyId,
  });
}

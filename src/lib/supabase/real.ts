// لایه اتصال به Supabase واقعی (real mode) — نسخه ۲.۰
// ============================================================
// این ماژول فقط زمانی فعال می‌شود که متغیرهای محیطی زیر تنظیم شده باشند:
//   NEXT_PUBLIC_SUPABASE_URL
//   NEXT_PUBLIC_SUPABASE_ANON_KEY
// در ساندباکس این متغیرها تنظیم نشده‌اند → realMode=false → حالت موک.
// در Vercel (با env vars) → realMode=true → اتصال واقعی.
//
// احراز هویت با username: email = username + "@accounting.local"
// (چون Supabase Auth email-based است؛ username واقعی در user_profiles).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Counterparty,
  Transaction,
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
    password: "", // هرگز رمز را برنمی‌گردانیم
    displayName: r.display_name,
    role: r.role,
    scope: r.scope ?? undefined,
    linkedCounterpartyId: r.linked_counterparty_id ?? null,
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
    direction: r.direction,
    amount: Number(r.amount),
    currency: r.currency,
    effectiveAt: r.effective_at,
    createdAt: r.created_at,
    createdBy: r.created_by,
    description: r.description ?? undefined,
    status: r.status,
    matchedTransactionId: r.matched_transaction_id ?? null,
    matchStatus: r.match_status,
    idempotencyKey: r.idempotency_key,
  };
}

// ---------------------------------------------------------------------------
// احراز هویت
// ---------------------------------------------------------------------------

export async function signInWithUsername(
  username: string,
  password: string
): Promise<void> {
  const c = getClient();
  if (!c) throw new Error("حالت واقعی فعال نیست.");
  const email = username.trim().toLowerCase() + "@accounting.local";
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOutReal(): Promise<void> {
  const c = getClient();
  if (!c) return;
  await c.auth.signOut();
}

// بازیابی نشست ذخیره‌شده (برای refresh صفحه)
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
  return mapUser(prof);
}

// ---------------------------------------------------------------------------
// خواندن داده
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

export async function fetchRealTransactions(userId: string): Promise<Transaction[]> {
  const c = getClient();
  if (!c) return [];
  const { data } = await c
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data || []).map(mapTransaction);
}

// ---------------------------------------------------------------------------
// جهش‌ها (Edge Functions)
// ---------------------------------------------------------------------------

export interface CreateTxnInput {
  direction: "received_from" | "paid_to";
  counterpartyId: string;
  amount: number;
  currency: "IRT" | "IRR";
  effectiveAt: string;
  description?: string;
}

export async function createTransactionReal(
  input: CreateTxnInput
): Promise<{ transaction: Transaction | null; matchedWith: Transaction | null }> {
  const res = await callEF("create-transaction", "POST", {
    direction: input.direction,
    counterpartyId: input.counterpartyId,
    amount: input.amount,
    currency: input.currency,
    effectiveAt: input.effectiveAt,
    description: input.description,
    idempotencyKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "idem-" + Date.now(),
  });
  return {
    transaction: res.transaction ? mapTransaction(res.transaction) : null,
    matchedWith: res.matchedWith ? mapTransaction(res.matchedWith) : null,
  };
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
  patch: { displayName?: string; password?: string; scope?: string }
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

// API functions برای تعامل با Supabase

import {
  Category,
  Contact,
  Currency,
  TelegramAccessScope,
  Transaction,
  TransactionType,
} from "@/lib/accounting/types";
import {
  getSupabaseAnonKey,
  getSupabaseClient,
  getSupabaseUrl,
} from "./client";

// =================== Auth ===================

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase پیکربندی نشده است");
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(translateAuthError(error.message));
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

// =================== Data fetching ===================

export async function fetchUserProfile(): Promise<{
  id: string;
  displayName: string | null;
} | null> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) return null;
  const { data: profile, error } = await client
    .from("profiles")
    .select("id, display_name")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;
  return { id: profile.id, displayName: profile.display_name };
}

export async function fetchLedgerId(userId: string): Promise<string | null> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("ledgers")
    .select("id")
    .eq("owner_user_id", userId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function fetchContacts(ledgerId: string): Promise<Contact[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("contacts")
    .select("*")
    .eq("ledger_id", ledgerId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    ledgerId: c.ledger_id,
    displayName: c.display_name,
    notes: c.notes ?? undefined,
    linkedTelegramId: c.linked_telegram_id?.toString() ?? null,
    createdAt: c.created_at,
  }));
}

export async function fetchCategories(ledgerId: string): Promise<Category[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("categories")
    .select("*")
    .eq("ledger_id", ledgerId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((c: any) => ({
    id: c.id,
    ledgerId: c.ledger_id,
    name: c.name,
    isActive: c.is_active,
    sortOrder: c.sort_order,
    createdAt: c.created_at,
    archivedAt: c.archived_at,
  }));
}

export async function fetchTransactions(
  ledgerId: string
): Promise<Transaction[]> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("transactions")
    .select("*")
    .eq("ledger_id", ledgerId)
    .order("effective_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
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
    status: t.status,
    idempotencyKey: t.idempotency_key,
  }));
}

export async function fetchAuditLogs(_ledgerId: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id,
    actorId: a.actor_id,
    action: a.action,
    entityType: a.entity_type,
    entityId: a.entity_id,
    result: a.result,
    details: a.details ?? undefined,
    createdAt: a.created_at,
  }));
}

export async function fetchTelegramLinks(ledgerId: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("telegram_links")
    .select("*")
    .eq("ledger_id", ledgerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((l: any) => ({
    id: l.id,
    contactId: l.contact_id,
    telegramUserId: l.telegram_user_id?.toString() ?? null,
    telegramUsername: l.telegram_username ?? null,
    status: l.status,
    scope: l.scope as TelegramAccessScope,
    linkedAt: l.linked_at,
    revokedAt: l.revoked_at,
    createdAt: l.created_at,
  }));
}

// =================== Mutations ===================

export async function addTransactionViaEdgeFunction(input: {
  contactId: string;
  categoryId?: string | null;
  transactionType: TransactionType;
  amount: number;
  currency: Currency;
  effectiveAt: string;
  description?: string;
}): Promise<Transaction> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase پیکربندی نشده است");
  const { data: sessionData } = await client.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("وارد نشده‌اید. لطفاً در تب «اتصال» وارد شوید.");

  const baseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!baseUrl || !anonKey)
    throw new Error("Supabase URL یا anon key تنظیم نشده است");

  const idempotencyKey =
    "client-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10);

  const response = await fetch(baseUrl + "/functions/v1/create-transaction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken,
      apikey: anonKey,
    },
    body: JSON.stringify({
      contactId: input.contactId,
      categoryId: input.categoryId ?? null,
      transactionType: input.transactionType,
      amount: input.amount,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      description: input.description ?? null,
      idempotencyKey,
    }),
  });

  if (!response.ok) {
    let message = "Edge Function خطا داد";
    try {
      const errorBody = await response.json();
      message = errorBody.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const result = await response.json();
  const t = result.transaction;
  return {
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
    status: t.status,
    idempotencyKey: t.idempotency_key,
  };
}

export async function addContactToSupabase(
  ledgerId: string,
  displayName: string,
  notes?: string
): Promise<Contact> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("contacts")
    .insert({
      ledger_id: ledgerId,
      display_name: displayName,
      notes: notes?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    ledgerId: data.ledger_id,
    displayName: data.display_name,
    notes: data.notes ?? undefined,
    createdAt: data.created_at,
  };
}

export async function addCategoryToSupabase(
  ledgerId: string,
  name: string
): Promise<Category> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { data, error } = await client
    .from("categories")
    .insert({ ledger_id: ledgerId, name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    ledgerId: data.ledger_id,
    name: data.name,
    isActive: data.is_active,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
  };
}

export async function generateLinkCodeInSupabase(
  contactId: string,
  ledgerId: string,
  scope: TelegramAccessScope
): Promise<{ code: string; expiresAt: string }> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await client.from("link_codes").insert({
    code,
    contact_id: contactId,
    ledger_id: ledgerId,
    scope,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { code, expiresAt };
}

export async function revokeTelegramLinkInSupabase(linkId: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error("Not configured");
  const { error } = await client
    .from("telegram_links")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", linkId);
  if (error) throw error;
}

// =================== Helpers ===================

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "ایمیل یا رمز اشتباه است.";
  }
  if (m.includes("email not confirmed")) {
    return "ایمیل شما تأیید نشده است. در داشبورد Supabase → Authentication → Users → کاربر را ویرایش کن و Confirm بزن.";
  }
  if (m.includes("too many requests")) {
    return "تعداد تلاش‌ها زیاد بود. چند دقیقه صبر کن و دوباره سعی کن.";
  }
  return msg;
}

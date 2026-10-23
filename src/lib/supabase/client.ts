// ماژول مدیریت Supabase client
// کاربر در تب «اتصال» URL و anon key را وارد می‌کند → در localStorage ذخیره می‌شود
// این ماژول یک Supabase client سینگلتون با آن config می‌سازد

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const STORAGE_KEY = "accounting_supabase_config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey: string | null = null;

export function getSupabaseConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SupabaseConfig;
    if (!parsed.url || !parsed.anonKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ url: url.trim(), anonKey: anonKey.trim() })
  );
  cachedClient = null;
  cachedConfigKey = null;
}

export function clearSupabaseConfig(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  cachedClient = null;
  cachedConfigKey = null;
}

function configKey(c: SupabaseConfig): string {
  return c.url + "|" + c.anonKey;
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig();
  if (!config) return null;
  const key = configKey(config);
  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "accounting_supabase_auth",
    },
  });
  cachedConfigKey = key;
  return cachedClient;
}

export function getSupabaseUrl(): string | null {
  return getSupabaseConfig()?.url ?? null;
}

export function getSupabaseAnonKey(): string | null {
  return getSupabaseConfig()?.anonKey ?? null;
}

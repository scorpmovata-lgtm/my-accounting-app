// مدیریت کلاینت Supabase — تنظیمات در localStorage نگه‌داری می‌شود
// تا کاربر بتواند URL و anon key پروژه خودش را وارد کند.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY = "accounting_supabase_config";
const AUTH_STORAGE_KEY = "accounting_supabase_auth";

// Cache نمونه کلاینت — اگر تنظیمات تغییر کند، با clearSupabaseConfig invalidated می‌شود.
let cachedClient: SupabaseClient | null = null;
let cachedConfigKey: string | null = null;

/**
 * خواندن تنظیمات Supabase از localStorage.
 * در محیط سرور (SSR) یا زمانی که تنظیماتی موجود نیست، null برمی‌گرداند.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (!parsed.url || !parsed.anonKey) return null;
    return { url: parsed.url, anonKey: parsed.anonKey };
  } catch {
    return null;
  }
}

/**
 * ذخیره تنظیمات Supabase در localStorage.
 * نمونه کلاینت کش‌شده invalidate می‌شود تا در بار بعدی با تنظیمات جدید ساخته شود.
 */
export function setSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === "undefined") return;
  const config: SupabaseConfig = { url: url.trim(), anonKey: anonKey.trim() };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  // invalidate cache
  cachedClient = null;
  cachedConfigKey = null;
}

/**
 * پاک کردن تنظیمات Supabase از localStorage و invalidate کردن کلاینت.
 */
export function clearSupabaseConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  // پاک کردن session auth هم (امنیت: نشست قبلی را از بین می‌برد)
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
  cachedClient = null;
  cachedConfigKey = null;
}

/**
 * ساخت یا بازگرداندن نمونه کلاینت Supabase.
 * اگر تنظیماتی موجود نباشد، null برمی‌گرداند.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) {
    cachedClient = null;
    cachedConfigKey = null;
    return null;
  }
  const configKey = `${config.url}::${config.anonKey}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }
  // ساخت کلاینت جدید
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  cachedConfigKey = configKey;
  return cachedClient;
}

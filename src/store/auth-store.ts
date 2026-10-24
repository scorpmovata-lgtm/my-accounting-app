// Auth store — مدیریت وضعیت احراز هویت کاربر با Supabase
// مهم: برای رفع مشکل refresh، روی onAuthStateChange با INITIAL_SESSION تکیه می‌کنیم
// و از getSession() فوری پرهیز می‌کنیم (race condition)

import { create } from "zustand";
import {
  fetchLedgerId,
  fetchUserProfile,
  signInWithEmail,
  signOutSupabase,
} from "@/lib/supabase/api";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  ledgerId: string | null;
  isAdmin: boolean;
}

interface AuthState {
  status: "loading" | "anonymous" | "authenticated";
  user: AuthUser | null;
  error: string | null;
  init: () => () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  error: null,

  init: () => {
    const client = getSupabaseClient();
    if (!client) {
      set({ status: "anonymous" });
      return () => {};
    }

    // استراتژی جدید: ابتدا onAuthStateChange را تنظیم کن
    // سپس با timeout fallback بررسی کن
    // این کار از race condition جلوگیری می‌کند

    // ۱. گوش دادن به تغییرات auth
    // INITIAL_SESSION: وقتی session از localStorage بار می‌شود
    // SIGNED_IN: وقتی کاربر وارد می‌شود
    // TOKEN_REFRESHED: وقتی توکن تمدید می‌شود
    // SIGNED_OUT: وقتی کاربر خارج می‌شود
    const { data: subscription } = client.auth.onAuthStateChange(
      async (event, session) => {
        if (
          event === "INITIAL_SESSION" ||
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED"
        ) {
          if (session) {
            // session موجود است — user info را fetch کن
            await get().refresh();
          } else {
            // session خالی است — کاربر وارد نشده
            set({ status: "anonymous", user: null });
          }
        } else if (event === "SIGNED_OUT") {
          set({ status: "anonymous", user: null });
        }
      }
    );

    // ۲. Fallback: اگر INITIAL_SESSION قبل از تنظیم listener صدا زده شده باشد
    // بعد از ۲ ثانیه، اگر هنوز loading است، دستی getSession را امتحان کن
    const fallbackTimer = setTimeout(async () => {
      const currentStatus = get().status;
      if (currentStatus === "loading") {
        try {
          const { data } = await client.auth.getSession();
          if (data.session) {
            await get().refresh();
          } else {
            set({ status: "anonymous", user: null });
          }
        } catch {
          set({ status: "anonymous", user: null });
        }
      }
    }, 2000);

    return () => {
      clearTimeout(fallbackTimer);
      subscription.subscription.unsubscribe();
    };
  },

  login: async (email, password) => {
    set({ error: null });
    try {
      await signInWithEmail(email, password);
      await get().refresh();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "خطای ناشناخته" });
      throw e;
    }
  },

  logout: async () => {
    await signOutSupabase();
    set({ status: "anonymous", user: null });
  },

  clearError: () => set({ error: null }),

  refresh: async () => {
    try {
      const client = getSupabaseClient();
      if (!client) {
        set({ status: "anonymous", user: null });
        return;
      }
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        set({ status: "anonymous", user: null });
        return;
      }
      const userId = sessionData.session.user.id;
      const expiresAt = sessionData.session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        set({ status: "anonymous", user: null });
        return;
      }
      const profile = await fetchUserProfile();
      if (!profile) {
        set({ status: "anonymous", user: null });
        return;
      }
      const ledgerId = await fetchLedgerId(userId);
      const isAdmin = ledgerId !== null;
      set({
        status: "authenticated",
        user: {
          id: userId,
          email: sessionData.session.user.email ?? null,
          displayName: profile.displayName,
          ledgerId,
          isAdmin,
        },
      });
    } catch (e) {
      set({
        status: "anonymous",
        user: null,
        error: e instanceof Error ? e.message : null,
      });
    }
  },
}));

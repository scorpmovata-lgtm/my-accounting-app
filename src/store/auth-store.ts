// Auth store — مدیریت وضعیت احراز هویت کاربر با Supabase

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
  // admin: اگر کاربر صاحب دفتر باشد (ledger.owner_user_id === auth.uid())
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

    // مرحله ۱: ابتدا session را از localStorage (persisted) بار کن
    // این کار برای رفع مشکل refresh ضروری است
    const initialize = async () => {
      try {
        // getSession() session persisted را از localStorage برمی‌گرداند
        const { data, error } = await client.auth.getSession();
        if (error || !data.session) {
          set({ status: "anonymous", user: null });
          return;
        }
        // session موجود است — اکنون user info را fetch کن
        await get().refresh();
      } catch (e) {
        set({ status: "anonymous", user: null });
      }
    };
    initialize();

    // مرحله ۲: گوش دادن به تغییرات auth برای آینده
    // INITIAL_SESSION: وقتی session از localStorage بار می‌شود
    // SIGNED_IN / TOKEN_REFRESHED: وقتی session تغییر می‌کند
    // SIGNED_OUT: وقتی کاربر خارج می‌شود
    const { data: subscription } = client.auth.onAuthStateChange(
      async (event) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "INITIAL_SESSION"
        ) {
          await get().refresh();
        } else if (event === "SIGNED_OUT") {
          set({ status: "anonymous", user: null });
        }
      }
    );

    return () => {
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
      // session را از client بگیر (هم از memory، هم از localStorage)
      const { data: sessionData } = await client.auth.getSession();
      if (!sessionData.session) {
        set({ status: "anonymous", user: null });
        return;
      }
      const userId = sessionData.session.user.id;
      // چک کن که session expired نباشد
      const expiresAt = sessionData.session.expires_at;
      if (expiresAt && expiresAt * 1000 < Date.now()) {
        // session expired — تلاش برای refresh یا sign out
        set({ status: "anonymous", user: null });
        return;
      }
      const profile = await fetchUserProfile();
      if (!profile) {
        set({ status: "anonymous", user: null });
        return;
      }
      const ledgerId = await fetchLedgerId(userId);
      // admin یعنی صاحب دفتری است که مال خودش است
      // اگر ledgerId یافت شد، یعنی کاربر صاحب دفتر است (trigger آن را ساخته)
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

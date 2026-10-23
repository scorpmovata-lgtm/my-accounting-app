// Auth store — مدیریت وضعیت احراز هویت کاربر با Supabase

import { create } from "zustand";
import {
  fetchLedgerId,
  fetchUserProfile,
  getCurrentSession,
  signInWithEmail,
  signOutSupabase,
} from "@/lib/supabase/api";
import { getSupabaseClient } from "@/lib/supabase/client";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  ledgerId: string | null;
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

    get().refresh();

    const { data: subscription } = client.auth.onAuthStateChange(
      async (event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
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
      const session = await getCurrentSession();
      if (!session) {
        set({ status: "anonymous", user: null });
        return;
      }
      const profile = await fetchUserProfile();
      if (!profile) {
        set({ status: "anonymous", user: null });
        return;
      }
      const ledgerId = await fetchLedgerId(profile.id);
      set({
        status: "authenticated",
        user: {
          id: profile.id,
          email: session.user.email ?? null,
          displayName: profile.displayName,
          ledgerId,
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

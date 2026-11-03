// Zustand store — دفتر حسابداری چندکاربری (نسخه ۲.۰، حالت موک)
// ============================================================
// این استور منبع واحدِ داده و احراز هویت است:
//   - users: همه کاربران سامانه (ادمین + کاربران عادی با scope)
//   - counterparties: طرف حساب‌های متمرکز (ممکن است به کاربر لینک باشند)
//   - transactions: همه تراکنش‌ها در همه دفترها
//   - auditLogs: گزارش‌های ممیزی
//   - currentUserId / authStatus / authError: نشست فعلی
//
// تطابق بین‌کاربری: پس از هر تغییر (افزودن تراکنش/کاربر/طرف حساب)،
// recomputeMatches وضعیت تطابق همه تراکنش‌ها را به‌روزرسانی می‌کند.

import { create } from "zustand";
import {
  AuditLogEntry,
  Counterparty,
  Currency,
  MatchStatus,
  Transaction,
  TxDirection,
  User,
  UserScope,
  UserRole,
} from "@/lib/accounting/types";
import {
  computeMatchStatus,
  isMatchingPair,
  validateTransactionInput,
} from "@/lib/accounting/engine";
import {
  seedAuditLogs,
  seedCounterparties,
  seedTransactions,
  seedUsers,
} from "@/lib/accounting/mock-data";
import {
  realMode,
  signInWithUsername,
  signOutReal,
  getCurrentRealUser,
  fetchRealUsers,
  fetchRealCounterparties,
  fetchRealTransactions,
  createTransactionReal,
  adminCreateUserReal,
  adminUpdateUserReal,
  adminDeleteUserReal,
  adminCreateCounterpartyReal,
  adminUpdateCounterpartyReal,
  adminDeleteCounterpartyReal,
} from "@/lib/supabase/real";

// ---------------------------------------------------------------------------
// انواع ورودی
// ---------------------------------------------------------------------------

export interface AddTransactionInput {
  direction: TxDirection;
  counterpartyId: string;
  amount: number;
  currency: Currency;
  effectiveAt: string; // شمسی yyyy-mm-dd
  description?: string;
}

export interface AddUserInput {
  username: string;
  password: string;
  displayName: string;
  role: UserRole;
  scope?: UserScope;
  linkedCounterpartyId?: string | null;
}

export interface AddCounterpartyInput {
  displayName: string;
  notes?: string;
  linkedUserId?: string | null;
}

interface Result {
  ok: boolean;
  error?: string;
}

interface AccountingState {
  // داده
  users: User[];
  counterparties: Counterparty[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];

  // احراز هویت
  realMode: boolean;
  authStatus: "loading" | "anonymous" | "authenticated";
  currentUserId: string | null;
  authError: string | null;
  login: (username: string, password: string) => Promise<Result>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  initRealSession: () => Promise<void>;
  loadRealData: () => Promise<void>;

  // مدیریت کاربران (ادمین)
  addUser: (input: AddUserInput, actorId: string) => Promise<Result & { user?: User }>;
  updateUser: (
    id: string,
    patch: Partial<
      Pick<User, "displayName" | "password" | "scope" | "linkedCounterpartyId">
    >,
    actorId: string
  ) => Promise<Result>;
  deleteUser: (id: string, actorId: string) => Promise<void>;

  // مدیریت طرف حساب‌ها (ادمین)
  addCounterparty: (
    input: AddCounterpartyInput,
    actorId: string
  ) => Promise<Result & { counterparty?: Counterparty }>;
  updateCounterparty: (
    id: string,
    patch: Partial<Pick<Counterparty, "displayName" | "notes" | "linkedUserId">>,
    actorId: string
  ) => Promise<Result>;
  deleteCounterparty: (id: string, actorId: string) => Promise<void>;

  // تراکنش‌ها
  addTransaction: (
    input: AddTransactionInput,
    actorId: string
  ) => Promise<Result & {
    transaction?: Transaction;
    matchedWith?: Transaction | null;
  }>;

  // داخلی
  recomputeMatches: () => void;
  logAction: (
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    result: "success" | "failure",
    details: string
  ) => void;
}

// ---------------------------------------------------------------------------
// ابزارها
// ---------------------------------------------------------------------------

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function findActorName(users: User[], id: string): string {
  return users.find((u) => u.id === id)?.displayName ?? "نامشخص";
}

/**
 * نرمال‌سازی ورودی کاربر:
 * - ارقام فارسی/عربی → لاتین (۱۲۳۴ / ١٢٣٤ → 1234)
 * - نویسه‌های عربی → فارسی (ي→ی ، ك→ک)
 * - حذف فاصله‌های ابتدا و انتها و نویسه‌های نامرئی RTL
 */
export function normalizeInput(raw: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return raw
    .replace(/[۰-۹٠-٩]/g, (d) => {
      const i = fa.indexOf(d);
      return String(i >= 0 ? i : ar.indexOf(d));
    })
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u200e\u202a-\u202e\ufeff]/g, "")
    .trim();
}

// ---------------------------------------------------------------------------
// استور
// ---------------------------------------------------------------------------

export const useAccountingStore = create<AccountingState>((set, get) => ({
  users: seedUsers,
  counterparties: seedCounterparties,
  transactions: seedTransactions,
  auditLogs: seedAuditLogs,

  realMode,
  // در حالت واقعی، ابتدا "loading" تا نشست بررسی شود؛ در موک "anonymous".
  authStatus: realMode ? "loading" : "anonymous",
  currentUserId: null,
  authError: null,

  // -------------------------------------------------------------------------
  // احراز هویت
  // -------------------------------------------------------------------------

  login: async (username, password) => {
    // نرمال‌سازی ورودی — کیبورد فارسی/فاصله اضافه نباید مانع ورود شود
    const usernameNorm = normalizeInput(username).toLowerCase();
    const passwordNorm = normalizeInput(password);
    // ---- حالت واقعی ----
    if (get().realMode) {
      try {
        await signInWithUsername(usernameNorm, passwordNorm);
        const u = await getCurrentRealUser();
        if (!u) {
          set({ authError: "پروفایل کاربر یافت نشد." });
          return { ok: false, error: "پروفایل کاربر یافت نشد." };
        }
        set({
          authStatus: "authenticated",
          currentUserId: u.id,
          authError: null,
        });
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "خطای ناشناخته";
        set({ authError: msg });
        return { ok: false, error: msg };
      }
    }
    // ---- حالت موک ----
    const users = get().users;
    const u = users.find((x) => x.username.toLowerCase() === usernameNorm);
    if (!u) {
      set({ authError: "نام کاربری یافت نشد." });
      return { ok: false, error: "نام کاربری یافت نشد." };
    }
    if (u.password !== passwordNorm) {
      set({ authError: "رمز عبور نادرست است." });
      return { ok: false, error: "رمز عبور نادرست است." };
    }
    set({
      authStatus: "authenticated",
      currentUserId: u.id,
      authError: null,
    });
    return { ok: true };
  },

  logout: async () => {
    if (get().realMode) {
      await signOutReal();
    }
    set({
      authStatus: "anonymous",
      currentUserId: null,
      authError: null,
      // بازگشت به داده موک در حالت موک
      ...(get().realMode
        ? {}
        : {
            users: seedUsers,
            counterparties: seedCounterparties,
            transactions: seedTransactions,
            auditLogs: seedAuditLogs,
          }),
    });
  },

  clearAuthError: () => set({ authError: null }),

  // بازیابی نشست ذخیره‌شده هنگام refresh (فقط حالت واقعی)
  initRealSession: async () => {
    if (!get().realMode) return;
    try {
      const u = await getCurrentRealUser();
      if (!u) {
        set({ authStatus: "anonymous" });
        return;
      }
      set({
        authStatus: "authenticated",
        currentUserId: u.id,
        authError: null,
      });
      await get().loadRealData();
    } catch {
      set({ authStatus: "anonymous" });
    }
  },

  // بارگذاری داده واقعی از Supabase
  loadRealData: async () => {
    if (!get().realMode) return;
    const uid_ = get().currentUserId;
    if (!uid_) return;
    try {
      const [users, counterparties, transactions] = await Promise.all([
        fetchRealUsers(),
        fetchRealCounterparties(),
        fetchRealTransactions(uid_),
      ]);
      set({ users, counterparties, transactions });
    } catch (e) {
      console.error("loadRealData error:", e);
    }
  },

  // -------------------------------------------------------------------------
  // مدیریت کاربران (ادمین)
  // -------------------------------------------------------------------------

  addUser: async (input, actorId) => {
    // ---- real branch ----
    if (get().realMode) {
      try {
        await adminCreateUserReal(input);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    // اعتبارسنجی
    const username = input.username.trim();
    if (!username) {
      return { ok: false, error: "نام کاربری الزامی است." };
    }
    if (username.length < 3) {
      return { ok: false, error: "نام کاربری باید حداقل ۳ نویسه باشد." };
    }
    if (
      state.users.some(
        (u) => u.username.toLowerCase() === username.toLowerCase()
      )
    ) {
      return { ok: false, error: "این نام کاربری قبلاً گرفته شده است." };
    }
    if (!input.password || input.password.length < 4) {
      return { ok: false, error: "رمز عبور باید حداقل ۴ نویسه باشد." };
    }
    if (!input.displayName.trim()) {
      return { ok: false, error: "نام نمایشی الزامی است." };
    }
    if (input.role === "user" && !input.scope) {
      return {
        ok: false,
        error: "برای کاربر عادی، سطح دسترسی باید مشخص شود.",
      };
    }

    const now = new Date().toISOString();
    const user: User = {
      id: uid("user"),
      username,
      password: input.password,
      displayName: input.displayName.trim(),
      role: input.role,
      scope: input.role === "user" ? input.scope : undefined,
      linkedCounterpartyId: input.linkedCounterpartyId ?? null,
      createdAt: now,
    };
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "ADD_USER",
      entityType: "User",
      entityId: user.id,
      result: "success",
      details: `افزودن کاربر «${user.displayName}» (${user.username}) با نقش ${
        user.role === "admin" ? "ادمین" : "کاربر"
      }`,
      createdAt: now,
    };
    set({
      users: [...state.users, user],
      auditLogs: [log, ...state.auditLogs],
    });
    return { ok: true, user };
  },

  updateUser: async (id, patch, actorId) => {
    if (get().realMode) {
      try {
        await adminUpdateUserReal(id, patch);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const user = state.users.find((u) => u.id === id);
    if (!user) return { ok: false, error: "کاربر یافت نشد." };
    const next: User = { ...user, ...patch };
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    const changes: string[] = [];
    if (patch.displayName && patch.displayName !== user.displayName) {
      changes.push(`نام نمایشی: «${user.displayName}» → «${patch.displayName}»`);
    }
    if (patch.password) changes.push("رمز عبور به‌روزرسانی شد");
    if (patch.scope && patch.scope !== user.scope) {
      changes.push(`سطح دسترسی تغییر کرد`);
    }
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "UPDATE_USER",
      entityType: "User",
      entityId: id,
      result: "success",
      details: `ویرایش کاربر «${user.displayName}»${
        changes.length ? " — " + changes.join("، ") : ""
      }`,
      createdAt: now,
    };
    set({
      users: state.users.map((u) => (u.id === id ? next : u)),
      auditLogs: [log, ...state.auditLogs],
    });
    return { ok: true };
  },

  deleteUser: async (id, actorId) => {
    if (get().realMode) {
      try {
        await adminDeleteUserReal(id);
        await get().loadRealData();
      } catch (e) {
        /* بی‌صدا */
      }
      return;
    }
    const state = get();
    const user = state.users.find((u) => u.id === id);
    if (!user) return;
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "DELETE_USER",
      entityType: "User",
      entityId: id,
      result: "success",
      details: `حذف کاربر «${user.displayName}» (${user.username})`,
      createdAt: now,
    };
    set({
      users: state.users.filter((u) => u.id !== id),
      auditLogs: [log, ...state.auditLogs],
    });
  },

  // -------------------------------------------------------------------------
  // مدیریت طرف حساب‌ها (ادمین)
  // -------------------------------------------------------------------------

  addCounterparty: async (input, actorId) => {
    if (get().realMode) {
      try {
        await adminCreateCounterpartyReal(input);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const name = input.displayName.trim();
    if (!name) {
      return { ok: false, error: "نام طرف حساب الزامی است." };
    }
    // اگر به کاربری لینک می‌شود، آن کاربر وجود داشته باشد
    let linkedUsername: string | null = null;
    if (input.linkedUserId) {
      const linkedUser = state.users.find((u) => u.id === input.linkedUserId);
      if (!linkedUser) {
        return { ok: false, error: "کاربر لینک‌شده یافت نشد." };
      }
      linkedUsername = linkedUser.username;
      // این کاربر قبلاً به طرف حساب دیگری لینک شده؟
      const alreadyLinked = state.counterparties.find(
        (c) => c.linkedUserId === input.linkedUserId
      );
      if (alreadyLinked) {
        return {
          ok: false,
          error: `کاربر «${linkedUser.displayName}» قبلاً به طرف حساب «${alreadyLinked.displayName}» لینک شده است.`,
        };
      }
    }
    const now = new Date().toISOString();
    const cp: Counterparty = {
      id: uid("cp"),
      displayName: name,
      notes: input.notes?.trim() || undefined,
      linkedUserId: input.linkedUserId ?? null,
      linkedUsername,
      createdBy: actorId,
      createdAt: now,
    };
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "ADD_COUNTERPARTY",
      entityType: "Counterparty",
      entityId: cp.id,
      result: "success",
      details: `افزودن طرف حساب «${cp.displayName}»${
        cp.linkedUsername ? ` (لینک به کاربر ${cp.linkedUsername})` : ""
      }`,
      createdAt: now,
    };
    set({
      counterparties: [...state.counterparties, cp],
      auditLogs: [log, ...state.auditLogs],
    });
    return { ok: true, counterparty: cp };
  },

  updateCounterparty: async (id, patch, actorId) => {
    if (get().realMode) {
      try {
        await adminUpdateCounterpartyReal(id, patch);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const cp = state.counterparties.find((c) => c.id === id);
    if (!cp) return { ok: false, error: "طرف حساب یافت نشد." };
    let linkedUsername = cp.linkedUsername ?? null;
    if (patch.linkedUserId !== undefined) {
      if (patch.linkedUserId) {
        const linkedUser = state.users.find((u) => u.id === patch.linkedUserId);
        if (!linkedUser) {
          return { ok: false, error: "کاربر لینک‌شده یافت نشد." };
        }
        const alreadyLinked = state.counterparties.find(
          (c) => c.id !== id && c.linkedUserId === patch.linkedUserId
        );
        if (alreadyLinked) {
          return {
            ok: false,
            error: `کاربر «${linkedUser.displayName}» قبلاً به طرف حساب دیگری لینک شده است.`,
          };
        }
        linkedUsername = linkedUser.username;
      } else {
        linkedUsername = null;
      }
    }
    const next: Counterparty = {
      ...cp,
      displayName: patch.displayName?.trim() || cp.displayName,
      notes: patch.notes !== undefined ? patch.notes.trim() || undefined : cp.notes,
      linkedUserId: patch.linkedUserId !== undefined ? patch.linkedUserId ?? null : cp.linkedUserId,
      linkedUsername,
    };
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "UPDATE_COUNTERPARTY",
      entityType: "Counterparty",
      entityId: id,
      result: "success",
      details: `ویرایش طرف حساب «${cp.displayName}»`,
      createdAt: now,
    };
    set({
      counterparties: state.counterparties.map((c) => (c.id === id ? next : c)),
      auditLogs: [log, ...state.auditLogs],
    });
    // تطابق‌ها ممکن است تغییر کنند (اگر لینک تغییر کرد)
    get().recomputeMatches();
    return { ok: true };
  },

  deleteCounterparty: async (id, actorId) => {
    if (get().realMode) {
      try {
        await adminDeleteCounterpartyReal(id);
        await get().loadRealData();
      } catch (e) {
        /* بی‌صدا */
      }
      return;
    }
    const state = get();
    const cp = state.counterparties.find((c) => c.id === id);
    if (!cp) return;
    // جلوگیری از حذف اگر تراکنشی به آن وابسته است
    const hasTxns = state.transactions.some((t) => t.counterpartyId === id);
    if (hasTxns) {
      return; // بی‌صدا رد کن — کامپوننت باید قبل از فراخوانی چک کند
    }
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "DELETE_COUNTERPARTY",
      entityType: "Counterparty",
      entityId: id,
      result: "success",
      details: `حذف طرف حساب «${cp.displayName}»`,
      createdAt: now,
    };
    set({
      counterparties: state.counterparties.filter((c) => c.id !== id),
      auditLogs: [log, ...state.auditLogs],
    });
  },

  // -------------------------------------------------------------------------
  // تراکنش‌ها
  // -------------------------------------------------------------------------

  addTransaction: async (input, actorId) => {
    // ---- real branch ----
    if (get().realMode) {
      try {
        const res = await createTransactionReal(input);
        await get().loadRealData();
        return {
          ok: true,
          transaction: res.transaction ?? undefined,
          matchedWith: res.matchedWith,
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const user = state.users.find((u) => u.id === actorId);
    if (!user) return { ok: false, error: "کاربر احراز هویت‌نشده." };

    // اعتبارسنجی ورودی
    const v = validateTransactionInput(input);
    if (!v.ok) {
      return { ok: false, error: v.error };
    }
    // طرف حساب موجود باشد
    const cp = state.counterparties.find((c) => c.id === input.counterpartyId);
    if (!cp) {
      return { ok: false, error: "طرف حساب یافت نشد." };
    }
    // جلوگیری از ثبت تراکنش با طرف حسابی که خودِ همین کاربر است
    if (cp.linkedUserId === actorId) {
      return {
        ok: false,
        error: "نمی‌توان با طرف حسابی که نماینده خودِ شماست تراکنش ثبت کرد.",
      };
    }

    const now = new Date().toISOString();
    const txn: Transaction = {
      id: uid("tx"),
      userId: actorId,
      counterpartyId: input.counterpartyId,
      direction: input.direction,
      amount: input.amount,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      createdAt: now,
      createdBy: actorId,
      description: input.description?.trim() || undefined,
      status: "POSTED",
      matchedTransactionId: null,
      matchStatus: "pending",
      idempotencyKey: uid("idem"),
    };

    // افزودن و سپس محاسبه تطابق‌ها
    set({ transactions: [txn, ...state.transactions] });
    get().recomputeMatches();

    // پیدا کردن تراکنش تطبیق‌یافته (پس از recompute)
    const updated = get().transactions.find((t) => t.id === txn.id);
    const matchedWith = updated?.matchedTransactionId
      ? get().transactions.find((t) => t.id === updated.matchedTransactionId) ??
        null
      : null;

    // گزارش ممیزی
    const actorName = findActorName(state.users, actorId);
    const cpName = cp.displayName;
    const dirLabel =
      input.direction === "received_from" ? "دریافت از" : "پرداخت به";
    const matchInfo = updated?.matchStatus;
    const matchDetail =
      matchInfo === "matched"
        ? ` — تطبیق‌یافته با سمت ${cp.linkedUsername ?? "طرف مقابل"}`
        : matchInfo === "pending"
        ? " — در انتظار ثبت توسط طرف مقابل"
        : "";
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "CREATE_TXN",
      entityType: "Transaction",
      entityId: txn.id,
      result: "success",
      details: `ثبت «${dirLabel} ${cpName} — ${input.amount.toLocaleString(
        "en-US"
      )} تومان در ${input.effectiveAt}»${matchDetail}`,
      createdAt: now,
    };
    set({ auditLogs: [log, ...get().auditLogs] });

    return { ok: true, transaction: updated ?? txn, matchedWith };
  },

  // -------------------------------------------------------------------------
  // داخلی
  // -------------------------------------------------------------------------

  recomputeMatches: () => {
    const state = get();
    const { transactions, counterparties } = state;
    const updated = transactions.map((t) => {
      const result = computeMatchStatus(t, transactions, counterparties);
      return {
        ...t,
        matchStatus: result.status,
        matchedTransactionId: result.matchedId,
      };
    });
    set({ transactions: updated });
  },

  logAction: (actorId, action, entityType, entityId, result, details) => {
    const state = get();
    const actorName = findActorName(state.users, actorId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action,
      entityType,
      entityId,
      result,
      details,
      createdAt: new Date().toISOString(),
    };
    set({ auditLogs: [log, ...state.auditLogs] });
  },
}));

// ---------------------------------------------------------------------------
// انتخابگرهای کمکی (pure functions — نه hook)
// ---------------------------------------------------------------------------

// کاربر فعلی بر اساس currentUserId
export function selectCurrentUser(state: AccountingState): User | null {
  if (!state.currentUserId) return null;
  return state.users.find((u) => u.id === state.currentUserId) ?? null;
}

// تراکنش‌های دفتر یک کاربر (مرتب بر اساس تاریخ شمسی نزولی)
export function selectUserTransactions(
  state: AccountingState,
  userId: string
): Transaction[] {
  return state.transactions
    .filter((t) => t.userId === userId)
    .slice()
    .sort((a, b) => {
      // نزولی بر اساس effectiveAt شمسی (رشته‌ای قابل مرتب‌سازی است)
      if (a.effectiveAt !== b.effectiveAt) {
        return b.effectiveAt.localeCompare(a.effectiveAt);
      }
      // اگر تاریخ برابر، بر اساس زمان ثبت نزولی
      return b.createdAt.localeCompare(a.createdAt);
    });
}

// یافتن طرف حساب با id
export function selectCounterparty(
  state: AccountingState,
  id: string
): Counterparty | undefined {
  return state.counterparties.find((c) => c.id === id);
}

// یافتن کاربر با id
export function selectUser(
  state: AccountingState,
  id: string
): User | undefined {
  return state.users.find((u) => u.id === id);
}

// وضعیت تطابق برچسب‌خورده برای نمایش
export function matchStatusLabel(status: MatchStatus): string {
  if (status === "matched") return "تطبیق‌یافته";
  if (status === "pending") return "در انتظار طرف مقابل";
  return "شخص عادی";
}

// صادرات کمکی برای استفاده در کامپوننت‌ها
export type { Transaction, User, Counterparty };
export { isMatchingPair };

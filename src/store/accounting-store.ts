// Zustand store — دفتر حسابداری چندکاربری (نسخه ۳.۰، دفترهای مستقل + دید دوجانبه)
// ============================================================
// این استور منبع واحدِ داده و احراز هویت است:
//   - users: همه کاربران سامانه (ادمین + کاربران عادی با scope)
//   - counterparties: مشترک (ادمین، با گرنت) + شخصی (کاربر)
//   - transactions: همه تراکنش‌ها (هر دفتر مستقل است — تطابق حذف شد)
//   - categories: دسته‌بندی‌های شخصی هر کاربر
//   - comments: کامنت‌های روی ردیف تراکنش (دوطرفه)
//   - grants: اجازه دیدن طرف‌حساب مشترک در فرم ثبت
//   - auditLogs: گزارش‌های ممیزی

import { create } from "zustand";
import {
  AccessGrant,
  AuditLogEntry,
  Category,
  Counterparty,
  Currency,
  KIND_LABELS,
  Transaction,
  TxnKind,
  User,
  UserScope,
  UserRole,
} from "@/lib/accounting/types";
import { validateTransactionInput } from "@/lib/accounting/engine";
import {
  seedAuditLogs,
  seedCategories,
  seedComments,
  seedCounterparties,
  seedGrants,
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
  fetchRealCategories,
  fetchRealComments,
  fetchRealGrants,
  createTransactionReal,
  updateTransactionReal,
  deleteTransactionReal,
  createCategoryReal,
  renameCategoryReal,
  updateCategoryReal,
  deleteCategoryReal,
  createPrivateCounterpartyReal,
  deletePrivateCounterpartyReal,
  addCommentReal,
  adminCreateUserReal,
  adminUpdateUserReal,
  adminDeleteUserReal,
  adminCreateCounterpartyReal,
  adminUpdateCounterpartyReal,
  adminDeleteCounterpartyReal,
  adminGrantCpReal,
  adminRevokeCpReal,
} from "@/lib/supabase/real";

// ---------------------------------------------------------------------------
// انواع ورودی
// ---------------------------------------------------------------------------

export interface AddTransactionInput {
  kind: TxnKind;
  counterpartyId: string;
  amount: number;
  currency: Currency;
  effectiveAt: string; // شمسی yyyy-mm-dd
  description?: string;
  categoryId?: string | null;
}

// ویرایش تراکنش — همه فیلدها اختیاری؛ فقط چیزی که داده شده تغییر می‌کند
export interface UpdateTransactionInput {
  kind?: TxnKind;
  counterpartyId?: string;
  amount?: number;
  currency?: Currency;
  effectiveAt?: string;
  description?: string;
  categoryId?: string | null;
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
  categories: Category[];
  comments: TxnCommentRow[];
  grants: AccessGrant[];
  auditLogs: AuditLogEntry[];

  // احراز هویت
  realMode: boolean;
  authStatus: "loading" | "anonymous" | "authenticated";
  currentUserId: string | null;
  authError: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<Result>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  initRealSession: () => Promise<void>;
  loadRealData: () => Promise<void>;

  // مدیریت کاربران (ادمین)
  addUser: (input: AddUserInput, actorId: string) => Promise<Result & { user?: User }>;
  updateUser: (
    id: string,
    patch: Partial<
      Pick<User, "displayName" | "password" | "scope" | "isActive">
    >,
    actorId: string
  ) => Promise<Result>;
  deleteUser: (id: string, actorId: string) => Promise<Result>;

  // مدیریت طرف حساب‌های مشترک (ادمین)
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

  // گرنت دسترسی طرف‌حساب مشترک (ادمین)
  grantCpAccess: (
    userId: string,
    counterpartyId: string,
    actorId: string
  ) => Promise<Result>;
  revokeCpAccess: (
    userId: string,
    counterpartyId: string,
    actorId: string
  ) => Promise<Result>;

  // دسته‌بندی شخصی
  //   counterpartyId: null → عمومی (همه طرف‌حساب‌ها) | string → مخصوص همان طرف‌حساب
  addCategory: (
    name: string,
    counterpartyId?: string | null
  ) => Promise<Result>;
  renameCategory: (id: string, name: string) => Promise<Result>;
  updateCategory: (
    id: string,
    patch: { name?: string; counterpartyId?: string | null }
  ) => Promise<Result>;
  deleteCategory: (id: string) => Promise<Result>;

  // طرف‌حساب شخصی
  addPrivateCounterparty: (
    displayName: string,
    notes?: string
  ) => Promise<Result>;
  deletePrivateCounterparty: (id: string) => Promise<Result>;

  // کامنت روی ردیف تراکنش (دوطرفه)
  addComment: (transactionId: string, body: string) => Promise<Result>;

  // تراکنش‌ها
  addTransaction: (
    input: AddTransactionInput,
    actorId: string
  ) => Promise<Result & { transaction?: Transaction }>;
  updateTransaction: (
    id: string,
    patch: UpdateTransactionInput,
    actorId: string
  ) => Promise<Result & { transaction?: Transaction }>;
  deleteTransaction: (
    id: string,
    actorId: string
  ) => Promise<Result>;

  // داخلی
  logAction: (
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    result: "success" | "failure",
    details: string
  ) => void;
}

// نام مستعار برای جلوگیری از تداخل نام با ماژول types
type TxnCommentRow = import("@/lib/accounting/types").TxnComment;

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

// آیا این کاربر می‌تواند با این طرف‌حساب تراکنش ثبت کند؟
// (ادمین: همه مشترک‌ها + شخصی خودش؛ کاربر: مشترکِ با گرنت + شخصی خودش)
function canUseCounterparty(
  state: { users: User[]; grants: AccessGrant[] },
  userId: string,
  cp: Counterparty | undefined
): boolean {
  if (!cp || cp.archivedAt) return false;
  if (cp.linkedUserId === userId) return false; // نماینده خودِ اوست
  const user = state.users.find((u) => u.id === userId);
  if (!user) return false;
  if (!cp.isShared) return cp.ownerUserId === userId;
  if (user.role === "admin") return true;
  return state.grants.some(
    (g) => g.userId === userId && g.counterpartyId === cp.id
  );
}

// آیا این کاربر می‌تواند روی این تراکنش کامنت بنویسد / کامنت‌هایش را ببیند؟
// (صاحب تراکنش یا کاربری که تراکنش درباره اوست)
function canSeeCommentsOf(
  state: { counterparties: Counterparty[] },
  meId: string,
  txn: Transaction
): boolean {
  if (txn.userId === meId) return true;
  const cp = state.counterparties.find((c) => c.id === txn.counterpartyId);
  return !!cp && cp.linkedUserId === meId;
}

// ---------------------------------------------------------------------------
// استور
// ---------------------------------------------------------------------------

export const useAccountingStore = create<AccountingState>((set, get) => ({
  users: seedUsers,
  counterparties: seedCounterparties,
  transactions: seedTransactions,
  categories: seedCategories,
  comments: seedComments,
  grants: seedGrants,
  auditLogs: seedAuditLogs,

  realMode,
  authStatus: realMode ? "loading" : "anonymous",
  currentUserId: null,
  authError: null,

  // -------------------------------------------------------------------------
  // احراز هویت
  // -------------------------------------------------------------------------

  login: async (username, password, rememberMe = false) => {
    const usernameNorm = normalizeInput(username).toLowerCase();
    const passwordNorm = normalizeInput(password);
    // ---- حالت واقعی ----
    if (get().realMode) {
      try {
        // پیش‌فرض: rememberMe = false → نشست در localStorage ذخیره نمی‌شود
        // و با بستن مرورگر از بین می‌رود (جلوگیری از ورود خودکار در موبایل)
        await signInWithUsername(usernameNorm, passwordNorm, rememberMe);
        const u = await getCurrentRealUser();
        if (!u) {
          const msg = "پروفایل کاربر یافت نشد.";
          set({ authError: msg });
          return { ok: false, error: msg };
        }
        if (u.isActive === false) {
          await signOutReal();
          const msg = "حساب کاربری شما توسط مدیر غیرفعال شده است.";
          set({ authError: msg });
          return { ok: false, error: msg };
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
    if (u.isActive === false) {
      const msg = "حساب کاربری شما توسط مدیر غیرفعال شده است.";
      set({ authError: msg });
      return { ok: false, error: msg };
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
    // داده‌ها عمداً ری‌ست نمی‌شوند: در حالت موک، تغییرات ادمین
    // (غیرفعال‌سازی کاربر، کاربر/طرف‌حساب جدید و…) باید در همان نشست
    // مرورگر باقی بماند تا مسیر «غیرفعال → ورود مسدود» قابل آزمایش باشد.
    // بازگشت به داده موک فقط با reload کامل صفحه (state اولیه seeds) رخ می‌دهد.
    set({
      authStatus: "anonymous",
      currentUserId: null,
      authError: null,
    });
  },

  clearAuthError: () => set({ authError: null }),

  // بازیابی نشست ذخیره‌شده هنگام refresh (فقط حالت واقعی)
  initRealSession: async () => {
    if (!get().realMode) return;
    try {
      const u = await getCurrentRealUser();
      if (!u || u.isActive === false) {
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

  // بارگذاری داده واقعی از Supabase (RLS محدود می‌کند)
  loadRealData: async () => {
    if (!get().realMode) return;
    const uid_ = get().currentUserId;
    if (!uid_) return;
    try {
      const [users, counterparties, transactions, categories, comments, grants] =
        await Promise.all([
          fetchRealUsers(),
          fetchRealCounterparties(),
          fetchRealTransactions(),
          fetchRealCategories(),
          fetchRealComments(),
          fetchRealGrants(),
        ]);
      set({ users, counterparties, transactions, categories, comments, grants });
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
      isActive: true,
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
      changes.push("سطح دسترسی تغییر کرد");
    }
    if (patch.isActive !== undefined && patch.isActive !== user.isActive) {
      changes.push(patch.isActive ? "فعال شد" : "غیرفعال شد");
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
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "خطا در حذف کاربر",
        };
      }
    }
    const state = get();
    const user = state.users.find((u) => u.id === id);
    if (!user) return { ok: false, error: "کاربر یافت نشد." };
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
      // حذف کاربر از فهرست
      users: state.users.filter((u) => u.id !== id),
      // تراکنش‌های این کاربر: چون در حالت موک FK نداریم، فقط از حالت
      //   currentUserId خارج می‌شوند ولی رکوردهایشان باقی می‌ماند
      //   (در حالت واقعی، EF این‌ها را به actor منتقل می‌کند)
      // counterparties که linked_user_id به این کاربر داشته → null + archive
      counterparties: state.counterparties.map((c) =>
        c.linkedUserId === id
          ? { ...c, linkedUserId: null, linkedUsername: null, archivedAt: now }
          : c
      ),
      auditLogs: [log, ...state.auditLogs],
    });
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // مدیریت طرف حساب‌های مشترک (ادمین)
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
      isShared: true,
      ownerUserId: null,
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
      details: `افزودن طرف حساب مشترک «${cp.displayName}»${
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
      grants: state.grants.filter((g) => g.counterpartyId !== id),
      auditLogs: [log, ...state.auditLogs],
    });
  },

  // -------------------------------------------------------------------------
  // گرنت دسترسی طرف‌حساب مشترک (ادمین)
  // -------------------------------------------------------------------------

  grantCpAccess: async (userId, counterpartyId, actorId) => {
    if (get().realMode) {
      try {
        await adminGrantCpReal(userId, counterpartyId);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const cp = state.counterparties.find((c) => c.id === counterpartyId);
    const user = state.users.find((u) => u.id === userId);
    if (!cp || !user) return { ok: false, error: "طرف حساب یا کاربر یافت نشد." };
    if (!cp.isShared) {
      return { ok: false, error: "این طرف حساب شخصی است و گرنت معنا ندارد." };
    }
    const exists = state.grants.find(
      (g) => g.userId === userId && g.counterpartyId === counterpartyId
    );
    if (exists) return { ok: true };
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    set({
      grants: [
        ...state.grants,
        {
          id: uid("gr"),
          userId,
          counterpartyId,
          grantedBy: actorId,
          createdAt: now,
        },
      ],
      auditLogs: [
        {
          id: uid("audit"),
          actorId,
          actorName,
          action: "GRANT_CP_ACCESS",
          entityType: "CounterpartyAccess",
          entityId: counterpartyId,
          result: "success",
          details: `دادن دسترسی طرف‌حساب «${cp.displayName}» به «${user.displayName}»`,
          createdAt: now,
        },
        ...state.auditLogs,
      ],
    });
    return { ok: true };
  },

  revokeCpAccess: async (userId, counterpartyId, actorId) => {
    if (get().realMode) {
      try {
        await adminRevokeCpReal(userId, counterpartyId);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const cp = state.counterparties.find((c) => c.id === counterpartyId);
    const user = state.users.find((u) => u.id === userId);
    const now = new Date().toISOString();
    const actorName = findActorName(state.users, actorId);
    set({
      grants: state.grants.filter(
        (g) => !(g.userId === userId && g.counterpartyId === counterpartyId)
      ),
      auditLogs: [
        {
          id: uid("audit"),
          actorId,
          actorName,
          action: "REVOKE_CP_ACCESS",
          entityType: "CounterpartyAccess",
          entityId: counterpartyId,
          result: "success",
          details: `گرفتن دسترسی طرف‌حساب «${cp?.displayName ?? "—"}» از «${
            user?.displayName ?? "—"
          }»`,
          createdAt: now,
        },
        ...state.auditLogs,
      ],
    });
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // دسته‌بندی شخصی
  // -------------------------------------------------------------------------

  addCategory: async (name, counterpartyId = null) => {
    const me = get().currentUserId;
    if (!me) return { ok: false, error: "احراز هویت نشده." };
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "نام دسته الزامی است." };
    // اگر counterpartyId پر شده، باید قابل استفاده برای کاربر باشد
    if (counterpartyId) {
      const state = get();
      const cp = state.counterparties.find((c) => c.id === counterpartyId);
      if (!cp) return { ok: false, error: "طرف‌حساب یافت نشد." };
      if (!canUseCounterparty(state, me, cp)) {
        return { ok: false, error: "شما به این طرف‌حساب دسترسی ندارید." };
      }
    }
    if (get().realMode) {
      try {
        const cat = await createCategoryReal(trimmed, counterpartyId);
        set({ categories: [...get().categories, cat] });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    // نام تکراری برای همان scope ممنوع (یک کاربر نمی‌تواند دو دسته با
    // نام تکراری داشته باشد — کلید یکتایی user_id+name است)
    if (
      state.categories.some(
        (c) => c.userId === me && c.name === trimmed
      )
    ) {
      return { ok: false, error: "دسته‌ای با همین نام وجود دارد." };
    }
    set({
      categories: [
        ...state.categories,
        {
          id: uid("cat"),
          userId: me,
          name: trimmed,
          createdAt: new Date().toISOString(),
          counterpartyId,
        },
      ],
    });
    return { ok: true };
  },

  renameCategory: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "نام دسته الزامی است." };
    if (get().realMode) {
      try {
        await renameCategoryReal(id, trimmed);
        set({
          categories: get().categories.map((c) =>
            c.id === id ? { ...c, name: trimmed } : c
          ),
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    set({
      categories: get().categories.map((c) =>
        c.id === id ? { ...c, name: trimmed } : c
      ),
    });
    return { ok: true };
  },

  updateCategory: async (id, patch) => {
    const me = get().currentUserId;
    if (!me) return { ok: false, error: "احراز هویت نشده." };
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return { ok: false, error: "نام دسته الزامی است." };
      patch.name = trimmed;
    }
    // اگر scope به یک طرف‌حساب خاص تغییر می‌کند، اعتبارسنجی دسترسی
    if (patch.counterpartyId !== undefined && patch.counterpartyId) {
      const state = get();
      const cp = state.counterparties.find((c) => c.id === patch.counterpartyId);
      if (!cp) return { ok: false, error: "طرف‌حساب یافت نشد." };
      if (!canUseCounterparty(state, me, cp)) {
        return { ok: false, error: "شما به این طرف‌حساب دسترسی ندارید." };
      }
    }
    if (get().realMode) {
      try {
        await updateCategoryReal(id, patch);
        set({
          categories: get().categories.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(patch.name !== undefined ? { name: patch.name } : {}),
                  ...(patch.counterpartyId !== undefined
                    ? { counterpartyId: patch.counterpartyId }
                    : {}),
                }
              : c
          ),
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    set({
      categories: get().categories.map((c) =>
        c.id === id
          ? {
              ...c,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.counterpartyId !== undefined
                ? { counterpartyId: patch.counterpartyId }
                : {}),
            }
          : c
      ),
    });
    return { ok: true };
  },

  deleteCategory: async (id) => {
    if (get().realMode) {
      try {
        await deleteCategoryReal(id);
        set({
          categories: get().categories.filter((c) => c.id !== id),
          // دسته‌ی حذف‌شده از تراکنش‌ها برداشته می‌شود (FK: on delete set null)
          transactions: get().transactions.map((t) =>
            t.categoryId === id ? { ...t, categoryId: null } : t
          ),
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    set({
      categories: get().categories.filter((c) => c.id !== id),
      transactions: get().transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: null } : t
      ),
    });
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // طرف‌حساب شخصی
  // -------------------------------------------------------------------------

  addPrivateCounterparty: async (displayName, notes) => {
    const me = get().currentUserId;
    if (!me) return { ok: false, error: "احراز هویت نشده." };
    const name = displayName.trim();
    if (!name) return { ok: false, error: "نام طرف حساب الزامی است." };
    if (get().realMode) {
      try {
        const cp = await createPrivateCounterpartyReal(name, notes);
        set({ counterparties: [...get().counterparties, cp] });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const now = new Date().toISOString();
    const cp: Counterparty = {
      id: uid("cp"),
      displayName: name,
      notes: notes?.trim() || undefined,
      linkedUserId: null,
      linkedUsername: null,
      isShared: false,
      ownerUserId: me,
      createdBy: me,
      createdAt: now,
    };
    set({ counterparties: [...state.counterparties, cp] });
    return { ok: true };
  },

  deletePrivateCounterparty: async (id) => {
    const me = get().currentUserId;
    if (!me) return { ok: false, error: "احراز هویت نشده." };
    const state = get();
    const cp = state.counterparties.find((c) => c.id === id);
    if (!cp) return { ok: false, error: "طرف حساب یافت نشد." };
    if (!cp.isShared || cp.ownerUserId !== me) {
      return { ok: false, error: "فقط طرف‌حساب شخصی خودتان قابل حذف است." };
    }
    const hasTxns = state.transactions.some((t) => t.counterpartyId === id);
    if (hasTxns) {
      return {
        ok: false,
        error: "این طرف حساب تراکنش ثبت‌شده دارد و قابل حذف نیست.",
      };
    }
    if (get().realMode) {
      try {
        await deletePrivateCounterpartyReal(id);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    set({ counterparties: state.counterparties.filter((c) => c.id !== id) });
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // کامنت روی ردیف تراکنش (دوطرفه)
  // -------------------------------------------------------------------------

  addComment: async (transactionId, body) => {
    const me = get().currentUserId;
    if (!me) return { ok: false, error: "احراز هویت نشده." };
    const text = body.trim();
    if (!text) return { ok: false, error: "متن کامنت خالی است." };
    const state = get();
    const txn = state.transactions.find((t) => t.id === transactionId);
    if (!txn) return { ok: false, error: "تراکنش یافت نشد." };
    if (!canSeeCommentsOf(state, me, txn)) {
      return {
        ok: false,
        error: "فقط صاحب تراکنش و کاربری که تراکنش درباره اوست می‌توانند کامنت بگذارند.",
      };
    }
    const authorName = findActorName(state.users, me);
    const now = new Date().toISOString();
    if (get().realMode) {
      try {
        const cm = await addCommentReal(transactionId, text);
        set({ comments: [...get().comments, cm] });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    set({
      comments: [
        ...state.comments,
        {
          id: uid("cm"),
          transactionId,
          authorId: me,
          authorName,
          body: text,
          createdAt: now,
        },
      ],
    });
    return { ok: true };
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
    // طرف حساب موجود و مجاز باشد
    const cp = state.counterparties.find((c) => c.id === input.counterpartyId);
    if (!cp) {
      return { ok: false, error: "طرف حساب یافت نشد." };
    }
    if (!canUseCounterparty(state, actorId, cp)) {
      return {
        ok: false,
        error:
          "شما به این طرف حساب دسترسی ندارید. (ادمین باید دسترسی بدهد یا از طرف‌حساب‌های شخصی خودتان استفاده کنید)",
      };
    }
    // دسته باید متعلق به خود کاربر باشد و (در صورت مخصوص بودن) با
    // طرف‌حساب این تراکنش منطبق باشد. دسته‌های عمومی با همه قابل استفاده‌اند.
    if (input.categoryId) {
      const cat = state.categories.find(
        (c) => c.id === input.categoryId && c.userId === actorId
      );
      if (!cat) {
        return { ok: false, error: "دسته‌بندی نامعتبر است." };
      }
      if (cat.counterpartyId && cat.counterpartyId !== input.counterpartyId) {
        return {
          ok: false,
          error: "این دسته‌بندی مخصوص طرف‌حساب دیگری است و برای این تراکنش قابل استفاده نیست.",
        };
      }
    }

    const now = new Date().toISOString();
    const txn: Transaction = {
      id: uid("tx"),
      userId: actorId,
      counterpartyId: input.counterpartyId,
      kind: input.kind,
      amount: input.amount,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      createdAt: now,
      createdBy: actorId,
      description: input.description?.trim() || undefined,
      categoryId: input.categoryId ?? null,
      status: "POSTED",
      idempotencyKey: uid("idem"),
    };

    set({ transactions: [txn, ...state.transactions] });

    // گزارش ممیزی
    const actorName = findActorName(state.users, actorId);
    const cpName = cp.displayName;
    const kindLabel = KIND_LABELS[input.kind];
    const cat = input.categoryId
      ? state.categories.find((c) => c.id === input.categoryId)
      : null;
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "CREATE_TXN",
      entityType: "Transaction",
      entityId: txn.id,
      result: "success",
      details: `ثبت «${kindLabel} ${cpName} — ${input.amount.toLocaleString(
        "en-US"
      )} تومان در ${input.effectiveAt}»${cat ? ` — دسته: ${cat.name}` : ""}`,
      createdAt: now,
    };
    set({ auditLogs: [log, ...get().auditLogs] });

    return { ok: true, transaction: txn };
  },

  // -------------------------------------------------------------------------
  // ویرایش تراکنش — فقط صاحب دفتر می‌تواند
  // -------------------------------------------------------------------------
  updateTransaction: async (id, patch, actorId) => {
    // ---- real branch ----
    if (get().realMode) {
      try {
        const res = await updateTransactionReal(id, patch);
        await get().loadRealData();
        return {
          ok: true,
          transaction: res.transaction ?? undefined,
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const txn = state.transactions.find((t) => t.id === id);
    if (!txn) return { ok: false, error: "تراکنش یافت نشد." };
    if (txn.userId !== actorId) {
      return {
        ok: false,
        error: "شما فقط می‌توانید تراکنش‌های خودتان را ویرایش کنید.",
      };
    }
    // اعتبارسنجی فیلدهای داده‌شده
    const v = validateTransactionInput({
      kind: patch.kind ?? txn.kind,
      amount: patch.amount ?? txn.amount,
      counterpartyId: patch.counterpartyId ?? txn.counterpartyId,
    });
    if (!v.ok) return { ok: false, error: v.error };
    // طرف‌حساب مجاز باشد (اگر تغییر کرده)
    const nextCpId = patch.counterpartyId ?? txn.counterpartyId;
    if (patch.counterpartyId && patch.counterpartyId !== txn.counterpartyId) {
      const cp = state.counterparties.find((c) => c.id === patch.counterpartyId);
      if (!cp) return { ok: false, error: "طرف حساب یافت نشد." };
      if (!canUseCounterparty(state, actorId, cp)) {
        return {
          ok: false,
          error: "شما به این طرف حساب دسترسی ندارید.",
        };
      }
    }
    // دسته باید متعلق به خود کاربر باشد (اگر تغییر کرده) و (در صورت مخصوص
    // بودن) با طرف‌حسابِ این تراکنش (که ممکن است خودش هم تغییر کرده باشد)
    // منطبق باشد. دسته‌های عمومی با همه قابل استفاده‌اند.
    if (
      patch.categoryId !== undefined &&
      patch.categoryId !== null &&
      patch.categoryId !== txn.categoryId
    ) {
      const cat = state.categories.find(
        (c) => c.id === patch.categoryId && c.userId === actorId
      );
      if (!cat) return { ok: false, error: "دسته‌بندی نامعتبر است." };
      if (cat.counterpartyId && cat.counterpartyId !== nextCpId) {
        return {
          ok: false,
          error: "این دسته‌بندی مخصوص طرف‌حساب دیگری است و برای این تراکنش قابل استفاده نیست.",
        };
      }
    }
    // اگر طرف‌حساب تغییر کرده و دسته قبلی مخصوص طرف‌حساب قدیمی بوده،
    // باید دسته را پاک کنیم (مگر اینکه کاربر صریحاً categoryId داده باشد)
    if (
      patch.counterpartyId &&
      patch.counterpartyId !== txn.counterpartyId &&
      txn.categoryId &&
      patch.categoryId === undefined
    ) {
      const oldCat = state.categories.find((c) => c.id === txn.categoryId);
      if (oldCat?.counterpartyId && oldCat.counterpartyId !== nextCpId) {
        // دسته قبلی مخصوص طرف‌حساب قدیمی بوده → به‌صورت خودکار پاک می‌کنیم
        patch.categoryId = null;
      }
    }

    const cpNow = state.counterparties.find((c) => c.id === nextCpId);
    const next: Transaction = {
      ...txn,
      kind: patch.kind ?? txn.kind,
      counterpartyId: nextCpId,
      amount: patch.amount ?? txn.amount,
      currency: patch.currency ?? txn.currency,
      effectiveAt: patch.effectiveAt ?? txn.effectiveAt,
      description:
        patch.description !== undefined
          ? patch.description?.trim() || undefined
          : txn.description,
      categoryId:
        patch.categoryId !== undefined ? patch.categoryId ?? null : txn.categoryId,
    };
    set({
      transactions: state.transactions.map((t) => (t.id === id ? next : t)),
    });

    // گزارش ممیزی — چه فیلدهایی تغییر کردند
    const actorName = findActorName(state.users, actorId);
    const changes: string[] = [];
    if (patch.kind && patch.kind !== txn.kind) changes.push("نوع");
    if (
      patch.counterpartyId &&
      patch.counterpartyId !== txn.counterpartyId
    )
      changes.push("طرف حساب");
    if (patch.amount !== undefined && patch.amount !== txn.amount)
      changes.push("مبلغ");
    if (
      patch.effectiveAt &&
      patch.effectiveAt !== txn.effectiveAt
    )
      changes.push("تاریخ");
    if (
      patch.description !== undefined &&
      patch.description !== (txn.description ?? "")
    )
      changes.push("توضیحات");
    if (
      patch.categoryId !== undefined &&
      patch.categoryId !== txn.categoryId
    )
      changes.push("دسته");
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "UPDATE_TXN",
      entityType: "Transaction",
      entityId: id,
      result: "success",
      details: `ویرایش تراکنش «${KIND_LABELS[txn.kind]} ${cpNow?.displayName ?? "—"}»${
        changes.length ? " — تغییر: " + changes.join("، ") : ""
      }`,
      createdAt: new Date().toISOString(),
    };
    set({ auditLogs: [log, ...get().auditLogs] });

    return { ok: true, transaction: next };
  },

  // -------------------------------------------------------------------------
  // حذف تراکنش — فقط صاحب دفتر می‌تواند
  // -------------------------------------------------------------------------
  deleteTransaction: async (id, actorId) => {
    // ---- real branch ----
    if (get().realMode) {
      try {
        await deleteTransactionReal(id);
        await get().loadRealData();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "خطا" };
      }
    }
    const state = get();
    const txn = state.transactions.find((t) => t.id === id);
    if (!txn) return { ok: false, error: "تراکنش یافت نشد." };
    if (txn.userId !== actorId) {
      return {
        ok: false,
        error: "شما فقط می‌توانید تراکنش‌های خودتان را حذف کنید.",
      };
    }
    const actorName = findActorName(state.users, actorId);
    const cp = state.counterparties.find((c) => c.id === txn.counterpartyId);
    const now = new Date().toISOString();
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId,
      actorName,
      action: "DELETE_TXN",
      entityType: "Transaction",
      entityId: id,
      result: "success",
      details: `حذف تراکنش «${KIND_LABELS[txn.kind]} ${cp?.displayName ?? "—"} — ${txn.amount.toLocaleString(
        "en-US"
      )} تومان در ${txn.effectiveAt}»`,
      createdAt: now,
    };
    set({
      // تراکنش حذف می‌شود
      transactions: state.transactions.filter((t) => t.id !== id),
      // کامنت‌های روی این تراکنش هم پاک می‌شوند (در حالت واقعی با cascade)
      comments: state.comments.filter((c) => c.transactionId !== id),
      auditLogs: [log, ...state.auditLogs],
    });
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // داخلی
  // -------------------------------------------------------------------------

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
      if (a.effectiveAt !== b.effectiveAt) {
        return b.effectiveAt.localeCompare(a.effectiveAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
}

// طرف‌حساب‌های قابل استفاده در فرم ثبتِ این کاربر
// (مشترکِ با گرنت + شخصی خودش؛ ادمین: همه مشترک‌ها + شخصی خودش)
export function selectUsableCounterparties(
  state: AccountingState,
  userId: string
): Counterparty[] {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return [];
  return state.counterparties.filter((cp) => {
    if (cp.archivedAt) return false;
    if (cp.linkedUserId === userId) return false;
    if (!cp.isShared) return cp.ownerUserId === userId;
    if (user.role === "admin") return true;
    return state.grants.some(
      (g) => g.userId === userId && g.counterpartyId === cp.id
    );
  });
}

// کامنت‌های قابل‌مشاهده‌ی این کاربر برای یک تراکنش
export function selectCommentsForTxn(
  state: AccountingState,
  meId: string,
  transactionId: string
): TxnCommentRow[] {
  const txn = state.transactions.find((t) => t.id === transactionId);
  if (!txn) return [];
  if (!canSeeCommentsOf(state, meId, txn)) return [];
  return state.comments
    .filter((c) => c.transactionId === transactionId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// تعداد کامنت‌های قابل‌مشاهده برای یک تراکنش (برای نشان روی ردیف)
export function selectCommentCount(
  state: AccountingState,
  meId: string,
  transactionId: string
): number {
  return selectCommentsForTxn(state, meId, transactionId).length;
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

// صادرات کمکی برای استفاده در کامپوننت‌ها
export type { Transaction, User, Counterparty };

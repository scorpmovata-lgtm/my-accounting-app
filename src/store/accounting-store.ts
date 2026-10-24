// Zustand store — مدیریت state کلاینت برای اپ حسابداری
// این store در دو حالت کار می‌کند:
//   - mockMode: داده موک seed شده و عملیات فقط روی state محلی انجام می‌شود.
//   - realMode: داده واقعی از Supabase خوانده می‌شود و عملیات از طریق Edge
//     Function یا Supabase Client مستقیماً اعمال می‌شوند.

import { create } from "zustand";
import {
  AuditLogEntry,
  Category,
  Contact,
  Currency,
  Ledger,
  LinkCode,
  TelegramLink,
  TelegramAccessScope,
  Transaction,
  TransactionType,
} from "@/lib/accounting/types";
import { validateTransaction } from "@/lib/accounting/engine";
import {
  seedAuditLogs,
  seedCategories,
  seedContacts,
  seedLedger,
  seedTelegramLinks,
  seedTransactions,
} from "@/lib/accounting/mock-data";
import {
  addCategoryToSupabase,
  addContactToSupabase,
  addTransactionViaEdgeFunction,
  fetchAuditLogs,
  fetchCategories,
  fetchContacts,
  fetchLedgerById,
  fetchTelegramLinks,
  fetchTransactions,
  generateLinkCodeInSupabase,
  revokeTelegramLinkInSupabase,
} from "@/lib/supabase/api";

export interface AddTransactionInput {
  contactId: string;
  categoryId?: string | null;
  transactionType: TransactionType;
  amount: number;
  currency: Currency;
  effectiveAt: string;
  description?: string;
  // هنگام true بودن، در mockMode پرداخت/دریافت بیش از مانده به دو تراکنش
  // (تخصیص تا سقف مانده + ایجاد طلب/بدهی برای مابه‌التفاوت) شکسته می‌شود.
  allowOverpay?: boolean;
}

export interface AddTransactionResult {
  ok: boolean;
  error?: string;
  transaction?: Transaction;
  // در حالت split (overpay در mock)، تراکنش دوم
  secondaryTransaction?: Transaction;
}

interface AccountingState {
  realMode: boolean;
  realLedgerId: string | null;
  realOwnerName: string | null;

  ledger: Ledger;
  contacts: Contact[];
  categories: Category[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];
  telegramLinks: TelegramLink[];
  linkCodes: LinkCode[];

  // کنترل حالت real
  activateRealMode: (ledgerId: string, ownerName: string) => Promise<void>;
  deactivateRealMode: () => void;
  loadRealData: () => Promise<void>;

  // اعمال (همگی async تا در realMode بتوانند API را صدا بزنند)
  addTransaction: (
    input: AddTransactionInput
  ) => Promise<AddTransactionResult>;
  addCategory: (name: string) => Promise<Category | null>;
  deactivateCategory: (id: string) => void;
  addContact: (name: string, notes?: string) => Promise<Contact | null>;
  generateLinkCode: (
    contactId: string,
    scope: TelegramAccessScope
  ) => Promise<LinkCode | null>;
  revokeTelegramLink: (id: string) => Promise<void>;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function makeLinkCode(): string {
  // کد ۶ رقمی
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const useAccountingStore = create<AccountingState>((set, get) => ({
  // state
  realMode: false,
  realLedgerId: null,
  realOwnerName: null,

  // داده پیش‌فرض (mock)
  ledger: seedLedger,
  contacts: seedContacts,
  categories: seedCategories,
  transactions: seedTransactions,
  auditLogs: seedAuditLogs,
  telegramLinks: seedTelegramLinks,
  linkCodes: [],

  // ============================================================
  // کنترل حالت real
  // ============================================================

  activateRealMode: async (ledgerId, ownerName) => {
    set({
      realMode: true,
      realLedgerId: ledgerId,
      realOwnerName: ownerName,
    });
    await get().loadRealData();
  },

  deactivateRealMode: () => {
    set({
      realMode: false,
      realLedgerId: null,
      realOwnerName: null,
      // بازگشت به داده موک
      ledger: seedLedger,
      contacts: seedContacts,
      categories: seedCategories,
      transactions: seedTransactions,
      auditLogs: seedAuditLogs,
      telegramLinks: seedTelegramLinks,
      linkCodes: [],
    });
  },

  loadRealData: async () => {
    const state = get();
    if (!state.realMode || !state.realLedgerId) return;
    const ledgerId = state.realLedgerId;
    try {
      const [ledger, contacts, categories, transactions, auditLogs, telegramLinks] =
        await Promise.all([
          fetchLedgerById(ledgerId),
          fetchContacts(ledgerId),
          fetchCategories(ledgerId),
          fetchTransactions(ledgerId),
          fetchAuditLogs(ledgerId),
          fetchTelegramLinks(ledgerId),
        ]);
      const finalLedger: Ledger = ledger
        ? {
            ...ledger,
            ownerName: state.realOwnerName ?? ledger.ownerName,
          }
        : {
            id: ledgerId,
            ownerName: state.realOwnerName ?? "صاحب دفتر",
            name: "دفتر شخصی من",
            defaultCurrency: "IRT",
            createdAt: new Date().toISOString(),
          };
      set({
        ledger: finalLedger,
        contacts,
        categories,
        transactions,
        auditLogs,
        telegramLinks,
        linkCodes: [],
      });
    } catch (e) {
      console.error("loadRealData error:", e);
    }
  },

  // ============================================================
  // Mutations
  // ============================================================

  addTransaction: async (input) => {
    const state = get();

    // حالت real: تماس با Edge Function
    if (state.realMode) {
      const result = await addTransactionViaEdgeFunction(input);
      if (result.ok && result.transaction) {
        set({
          transactions: [result.transaction, ...state.transactions],
        });
        // تلاش برای به‌روزرسانی audit logs از سرور
        void get().loadRealData();
        return { ok: true, transaction: result.transaction };
      }
      return { ok: false, error: result.error };
    }

    // حالت mock
    // اعتبارسنجی
    const validation = validateTransaction(
      {
        contactId: input.contactId,
        transactionType: input.transactionType,
        amount: input.amount,
      },
      state.transactions
    );

    // بررسی overpay
    const isReceipt = input.transactionType === "RECEIPT_ALLOCATION";
    const isPayment = input.transactionType === "PAYMENT_ALLOCATION";

    // محاسبه مانده فعلی برای این مخاطب
    let outstandingReceivable = 0;
    let outstandingPayable = 0;
    {
      const contactTxns = state.transactions.filter(
        (t) =>
          t.contactId === input.contactId &&
          t.status === "POSTED"
      );
      for (const t of contactTxns) {
        const eff =
          t.transactionType === "RECEIVABLE_CHARGE" ||
          t.transactionType === "OPENING_RECEIVABLE"
            ? "receivable+"
            : t.transactionType === "RECEIPT_ALLOCATION"
            ? "receivable-"
            : t.transactionType === "PAYABLE_CHARGE" ||
              t.transactionType === "OPENING_PAYABLE"
            ? "payable+"
            : t.transactionType === "PAYMENT_ALLOCATION"
            ? "payable-"
            : null;
        if (eff === "receivable+") outstandingReceivable += t.amount;
        else if (eff === "receivable-") outstandingReceivable -= t.amount;
        else if (eff === "payable+") outstandingPayable += t.amount;
        else if (eff === "payable-") outstandingPayable -= t.amount;
      }
    }

    // اگر overpay مجاز است و receipt > receivable یا payment > payable
    const overpayReceipt = isReceipt && input.amount > outstandingReceivable;
    const overpayPayment = isPayment && input.amount > outstandingPayable;

    if (!validation.ok && !((overpayReceipt || overpayPayment) && input.allowOverpay)) {
      const failLog: AuditLogEntry = {
        id: uid("audit"),
        actorId: "owner",
        action: "CREATE_TXN",
        entityType: "Transaction",
        entityId: "—",
        result: "failure",
        details: `تلاش ناموفق ثبت تراکنش: ${validation.error}`,
        createdAt: new Date().toISOString(),
      };
      set({ auditLogs: [failLog, ...state.auditLogs] });
      return { ok: false, error: validation.error };
    }

    const contact = state.contacts.find((c) => c.id === input.contactId);
    const now = new Date().toISOString();

    // حالت split (overpay در mock)
    if (overpayReceipt && input.allowOverpay) {
      const receiptAmount = outstandingReceivable;
      const excessAmount = input.amount - outstandingReceivable;
      const primaryTxn: Transaction = {
        id: uid("tx"),
        ledgerId: state.ledger.id,
        contactId: input.contactId,
        categoryId: input.categoryId ?? null,
        transactionType: "RECEIPT_ALLOCATION",
        amount: receiptAmount,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        createdAt: now,
        createdBy: "owner",
        description: input.description,
        status: "POSTED",
        idempotencyKey: uid("idem"),
      };
      const secondaryTxn: Transaction = {
        id: uid("tx"),
        ledgerId: state.ledger.id,
        contactId: input.contactId,
        categoryId: input.categoryId ?? null,
        transactionType: "PAYABLE_CHARGE",
        amount: excessAmount,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        createdAt: now,
        createdBy: "owner",
        description: input.description
          ? `${input.description} (پرداخت اضافه)`
          : "پرداخت اضافه",
        status: "POSTED",
        idempotencyKey: uid("idem"),
      };
      const log: AuditLogEntry = {
        id: uid("audit"),
        actorId: "owner",
        action: "CREATE_TXN",
        entityType: "Transaction",
        entityId: primaryTxn.id,
        result: "success",
        details: `دریافت ${receiptAmount.toLocaleString(
          "en-US"
        )} ${input.currency === "IRT" ? "تومان" : "ریال"} + ایجاد بدهی ${excessAmount.toLocaleString(
          "en-US"
        )} (پرداخت اضافه) برای ${
          contact?.displayName ?? "نامشخص"
        }`,
        createdAt: now,
      };
      set({
        transactions: [secondaryTxn, primaryTxn, ...state.transactions],
        auditLogs: [log, ...state.auditLogs],
      });
      return { ok: true, transaction: primaryTxn, secondaryTransaction: secondaryTxn };
    }

    if (overpayPayment && input.allowOverpay) {
      const paymentAmount = outstandingPayable;
      const excessAmount = input.amount - outstandingPayable;
      const primaryTxn: Transaction = {
        id: uid("tx"),
        ledgerId: state.ledger.id,
        contactId: input.contactId,
        categoryId: input.categoryId ?? null,
        transactionType: "PAYMENT_ALLOCATION",
        amount: paymentAmount,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        createdAt: now,
        createdBy: "owner",
        description: input.description,
        status: "POSTED",
        idempotencyKey: uid("idem"),
      };
      const secondaryTxn: Transaction = {
        id: uid("tx"),
        ledgerId: state.ledger.id,
        contactId: input.contactId,
        categoryId: input.categoryId ?? null,
        transactionType: "RECEIVABLE_CHARGE",
        amount: excessAmount,
        currency: input.currency,
        effectiveAt: input.effectiveAt,
        createdAt: now,
        createdBy: "owner",
        description: input.description
          ? `${input.description} (پرداخت اضافه)`
          : "پرداخت اضافه",
        status: "POSTED",
        idempotencyKey: uid("idem"),
      };
      const log: AuditLogEntry = {
        id: uid("audit"),
        actorId: "owner",
        action: "CREATE_TXN",
        entityType: "Transaction",
        entityId: primaryTxn.id,
        result: "success",
        details: `پرداخت ${paymentAmount.toLocaleString(
          "en-US"
        )} ${input.currency === "IRT" ? "تومان" : "ریال"} + ایجاد طلب ${excessAmount.toLocaleString(
          "en-US"
        )} (پرداخت اضافه) برای ${
          contact?.displayName ?? "نامشخص"
        }`,
        createdAt: now,
      };
      set({
        transactions: [secondaryTxn, primaryTxn, ...state.transactions],
        auditLogs: [log, ...state.auditLogs],
      });
      return { ok: true, transaction: primaryTxn, secondaryTransaction: secondaryTxn };
    }

    // حالت عادی (بدون overpay)
    const txn: Transaction = {
      id: uid("tx"),
      ledgerId: state.ledger.id,
      contactId: input.contactId,
      categoryId: input.categoryId ?? null,
      transactionType: input.transactionType,
      amount: input.amount,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      createdAt: now,
      createdBy: "owner",
      description: input.description,
      status: "POSTED",
      idempotencyKey: uid("idem"),
    };

    const successLog: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "CREATE_TXN",
      entityType: "Transaction",
      entityId: txn.id,
      result: "success",
      details: `ثبت تراکنش ${input.amount.toLocaleString(
        "en-US"
      )} ${input.currency === "IRT" ? "تومان" : "ریال"} برای ${
        contact?.displayName ?? "نامشخص"
      }`,
      createdAt: now,
    };

    set({
      transactions: [txn, ...state.transactions],
      auditLogs: [successLog, ...state.auditLogs],
    });

    return { ok: true, transaction: txn };
  },

  addCategory: async (name) => {
    const state = get();

    // حالت real
    if (state.realMode && state.realLedgerId) {
      const cat = await addCategoryToSupabase(state.realLedgerId, name);
      if (cat) {
        set({ categories: [...state.categories, cat] });
        return cat;
      }
      return null;
    }

    // حالت mock
    const cat: Category = {
      id: uid("cat"),
      ledgerId: state.ledger.id,
      name: name.trim(),
      isActive: true,
      sortOrder: state.categories.length + 1,
      createdAt: new Date().toISOString(),
    };
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "ADD_CATEGORY",
      entityType: "Category",
      entityId: cat.id,
      result: "success",
      details: `افزودن سرفصل «${name}»`,
      createdAt: cat.createdAt,
    };
    set({
      categories: [...state.categories, cat],
      auditLogs: [log, ...state.auditLogs],
    });
    return cat;
  },

  deactivateCategory: (id) => {
    const state = get();
    const cat = state.categories.find((c) => c.id === id);
    if (!cat) return;
    const updated: Category = {
      ...cat,
      isActive: false,
      archivedAt: new Date().toISOString(),
    };
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "DEACTIVATE_CATEGORY",
      entityType: "Category",
      entityId: id,
      result: "success",
      details: `غیرفعال‌سازی سرفصل «${cat.name}»`,
      createdAt: updated.archivedAt!,
    };
    set({
      categories: state.categories.map((c) => (c.id === id ? updated : c)),
      auditLogs: [log, ...state.auditLogs],
    });
  },

  addContact: async (name, notes) => {
    const state = get();

    // حالت real
    if (state.realMode && state.realLedgerId) {
      const contact = await addContactToSupabase(
        state.realLedgerId,
        name,
        notes
      );
      if (contact) {
        set({ contacts: [...state.contacts, contact] });
        return contact;
      }
      return null;
    }

    // حالت mock
    const contact: Contact = {
      id: uid("contact"),
      ledgerId: state.ledger.id,
      displayName: name.trim(),
      notes: notes?.trim() || undefined,
      linkedTelegramId: null,
      linkedProfileId: null,
      createdAt: new Date().toISOString(),
    };
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "ADD_CONTACT",
      entityType: "Contact",
      entityId: contact.id,
      result: "success",
      details: `افزودن طرف حساب «${name}»`,
      createdAt: contact.createdAt,
    };
    set({
      contacts: [...state.contacts, contact],
      auditLogs: [log, ...state.auditLogs],
    });
    return contact;
  },

  generateLinkCode: async (contactId, scope) => {
    const state = get();
    const contact = state.contacts.find((c) => c.id === contactId);
    if (!contact) return null;

    // حالت real
    if (state.realMode && state.realLedgerId) {
      const result = await generateLinkCodeInSupabase(
        state.realLedgerId,
        contactId,
        scope
      );
      if (!result) return null;
      const linkCode: LinkCode = {
        code: result.code,
        contactId,
        scope,
        expiresAt: result.expiresAt,
        used: false,
        createdAt: new Date().toISOString(),
      };
      const log: AuditLogEntry = {
        id: uid("audit"),
        actorId: "owner",
        action: "GENERATE_LINK_CODE",
        entityType: "Contact",
        entityId: contactId,
        result: "success",
        details: `تولید کد اتصال تلگرام برای «${contact.displayName}»`,
        createdAt: linkCode.createdAt,
      };
      set({
        linkCodes: [linkCode, ...state.linkCodes],
        auditLogs: [log, ...state.auditLogs],
      });
      return linkCode;
    }

    // حالت mock
    const now = Date.now();
    const linkCode: LinkCode = {
      code: makeLinkCode(),
      contactId,
      scope,
      expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
      used: false,
      createdAt: new Date(now).toISOString(),
    };
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "GENERATE_LINK_CODE",
      entityType: "Contact",
      entityId: contactId,
      result: "success",
      details: `تولید کد اتصال تلگرام برای «${contact.displayName}» (دسترسی: ${
        scope === "balance_only"
          ? "فقط مانده"
          : scope === "transaction_list"
          ? "فهرست تراکنش‌ها"
          : scope === "transaction_details"
          ? "جزئیات تراکنش‌ها"
          : "گزارش سرفصلی"
      })`,
      createdAt: linkCode.createdAt,
    };
    set({
      linkCodes: [linkCode, ...state.linkCodes],
      auditLogs: [log, ...state.auditLogs],
    });
    return linkCode;
  },

  revokeTelegramLink: async (id) => {
    const state = get();
    const link = state.telegramLinks.find((l) => l.id === id);
    if (!link) return;

    // حالت real
    if (state.realMode) {
      const ok = await revokeTelegramLinkInSupabase(id);
      if (!ok) return;
    }

    const updated: TelegramLink = {
      ...link,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    };
    const contact = state.contacts.find((c) => c.id === link.contactId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: "owner",
      action: "REVOKE_TELEGRAM_LINK",
      entityType: "TelegramLink",
      entityId: id,
      result: "success",
      details: `لغو اتصال تلگرام «${
        contact?.displayName ?? link.telegramUsername ?? "نامشخص"
      }»`,
      createdAt: updated.revokedAt!,
    };
    set({
      telegramLinks: state.telegramLinks.map((l) =>
        l.id === id ? updated : l
      ),
      auditLogs: [log, ...state.auditLogs],
    });
  },
}));

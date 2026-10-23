// Zustand store — مدیریت state کلاینت برای پروتوتایپ
// در نسخه واقعی، این store به‌جای نگه‌داری داده، فقط cache داده از Supabase است.

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

export interface AddTransactionInput {
  contactId: string;
  categoryId?: string | null;
  transactionType: TransactionType;
  amount: number;
  currency: Currency;
  effectiveAt: string;
  description?: string;
}

interface AccountingState {
  ledger: Ledger;
  contacts: Contact[];
  categories: Category[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];
  telegramLinks: TelegramLink[];
  linkCodes: LinkCode[];

  // اعمال
  addTransaction: (
    input: AddTransactionInput
  ) => { ok: boolean; error?: string; transaction?: Transaction };
  addCategory: (name: string) => Category;
  deactivateCategory: (id: string) => void;
  addContact: (name: string, notes?: string) => Contact;
  generateLinkCode: (
    contactId: string,
    scope: TelegramAccessScope
  ) => LinkCode | null;
  revokeTelegramLink: (id: string) => void;
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
  ledger: seedLedger,
  contacts: seedContacts,
  categories: seedCategories,
  transactions: seedTransactions,
  auditLogs: seedAuditLogs,
  telegramLinks: seedTelegramLinks,
  linkCodes: [],

  addTransaction: (input) => {
    const state = get();
    // اعتبارسنجی طبق سند طراحی
    const validation = validateTransaction(
      {
        contactId: input.contactId,
        transactionType: input.transactionType,
        amount: input.amount,
      },
      state.transactions
    );
    if (!validation.ok) {
      // ثبت audit log برای عملیات ناموفق
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

    const txn: Transaction = {
      id: uid("tx"),
      ledgerId: state.ledger.id,
      contactId: input.contactId,
      categoryId: input.categoryId ?? null,
      transactionType: input.transactionType,
      amount: input.amount,
      currency: input.currency,
      effectiveAt: input.effectiveAt,
      createdAt: new Date().toISOString(),
      createdBy: "owner",
      description: input.description,
      status: "POSTED",
      idempotencyKey: uid("idem"),
    };

    const contact = state.contacts.find((c) => c.id === input.contactId);
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
      createdAt: txn.createdAt,
    };

    set({
      transactions: [txn, ...state.transactions],
      auditLogs: [successLog, ...state.auditLogs],
    });

    return { ok: true, transaction: txn };
  },

  addCategory: (name) => {
    const state = get();
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

  addContact: (name, notes) => {
    const state = get();
    const contact: Contact = {
      id: uid("contact"),
      ledgerId: state.ledger.id,
      displayName: name.trim(),
      notes: notes?.trim() || undefined,
      linkedTelegramId: null,
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

  generateLinkCode: (contactId, scope) => {
    const state = get();
    const contact = state.contacts.find((c) => c.id === contactId);
    if (!contact) return null;
    const now = Date.now();
    const linkCode: LinkCode = {
      code: makeLinkCode(),
      contactId,
      scope,
      // انقضا ۱۰ دقیقه
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

  revokeTelegramLink: (id) => {
    const state = get();
    const link = state.telegramLinks.find((l) => l.id === id);
    if (!link) return;
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

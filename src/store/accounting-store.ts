// Zustand store — مدیریت state کلاینت
// دو حالت دارد:
//   - mock mode (پیش‌فرض): داده از mock-data.ts می‌آید، عملیات لوکال هستند
//   - real mode: داده از Supabase می‌آید، عملیات از طریق Edge Function/API انجام می‌شوند

import { create } from "zustand";
import {
  AuditLogEntry,
  Category,
  Contact,
  Currency,
  Ledger,
  LinkCode,
  TelegramAccessScope,
  TelegramLink,
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
}

interface AccountingState {
  ledger: Ledger;
  contacts: Contact[];
  categories: Category[];
  transactions: Transaction[];
  auditLogs: AuditLogEntry[];
  telegramLinks: TelegramLink[];
  linkCodes: LinkCode[];

  realMode: boolean;
  realLedgerId: string | null;

  activateRealMode: (ledgerId: string, ownerName: string) => Promise<void>;
  deactivateRealMode: () => void;
  loadRealData: () => Promise<void>;

  addTransaction: (
    input: AddTransactionInput
  ) => Promise<{ ok: boolean; error?: string; transaction?: Transaction }>;
  addCategory: (name: string) => Promise<Category>;
  deactivateCategory: (id: string) => void;
  addContact: (name: string, notes?: string) => Promise<Contact>;
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
  realMode: false,
  realLedgerId: null,

  activateRealMode: async (ledgerId, ownerName) => {
    set({
      realMode: true,
      realLedgerId: ledgerId,
      ledger: { ...seedLedger, ownerName, name: "دفتر شخصی " + ownerName },
    });
    await get().loadRealData();
  },

  deactivateRealMode: () => {
    set({
      realMode: false,
      realLedgerId: null,
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
    const ledgerId = get().realLedgerId;
    if (!ledgerId) return;
    try {
      const [contacts, categories, transactions, telegramLinks, auditLogs] =
        await Promise.all([
          fetchContacts(ledgerId),
          fetchCategories(ledgerId),
          fetchTransactions(ledgerId),
          fetchTelegramLinks(ledgerId),
          fetchAuditLogs(ledgerId),
        ]);
      set({
        contacts,
        categories,
        transactions,
        telegramLinks,
        auditLogs,
        linkCodes: [],
      });
    } catch (e) {
      console.error("loadRealData error:", e);
      throw e;
    }
  },

  addTransaction: async (input) => {
    const state = get();

    if (state.realMode) {
      try {
        const txn = await addTransactionViaEdgeFunction(input);
        const contact = state.contacts.find((c) => c.id === input.contactId);
        const log: AuditLogEntry = {
          id: uid("audit"),
          actorId: "real",
          action: "CREATE_TXN",
          entityType: "Transaction",
          entityId: txn.id,
          result: "success",
          details: `ثبت تراکنش ${input.amount.toLocaleString(
            "en-US"
          )} ${input.currency === "IRT" ? "تومان" : "ریال"} برای ${
            contact?.displayName ?? "—"
          }`,
          createdAt: txn.createdAt,
        };
        set({
          transactions: [txn, ...state.transactions],
          auditLogs: [log, ...state.auditLogs],
        });
        return { ok: true, transaction: txn };
      } catch (e) {
        const errorMessage =
          e instanceof Error ? e.message : "خطای ناشناخته در Edge Function";
        const log: AuditLogEntry = {
          id: uid("audit"),
          actorId: "real",
          action: "CREATE_TXN",
          entityType: "Transaction",
          entityId: "—",
          result: "failure",
          details: `تلاش ناموفق: ${errorMessage}`,
          createdAt: new Date().toISOString(),
        };
        set({ auditLogs: [log, ...state.auditLogs] });
        return { ok: false, error: errorMessage };
      }
    }

    // حالت موک
    const validation = validateTransaction(
      {
        contactId: input.contactId,
        transactionType: input.transactionType,
        amount: input.amount,
      },
      state.transactions
    );
    if (!validation.ok) {
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

  addCategory: async (name) => {
    const state = get();

    if (state.realMode && state.realLedgerId) {
      const cat = await addCategoryToSupabase(state.realLedgerId, name);
      set({ categories: [...state.categories, cat] });
      return cat;
    }

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
      actorId: state.realMode ? "real" : "owner",
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

    if (state.realMode && state.realLedgerId) {
      const contact = await addContactToSupabase(
        state.realLedgerId,
        name,
        notes
      );
      set({ contacts: [...state.contacts, contact] });
      return contact;
    }

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

  generateLinkCode: async (contactId, scope) => {
    const state = get();
    const contact = state.contacts.find((c) => c.id === contactId);
    if (!contact) return null;

    if (state.realMode && state.realLedgerId) {
      const result = await generateLinkCodeInSupabase(
        contactId,
        state.realLedgerId,
        scope
      );
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
        actorId: "real",
        action: "GENERATE_LINK_CODE",
        entityType: "Contact",
        entityId: contactId,
        result: "success",
        details: `تولید کد اتصال تلگرام برای «${contact.displayName}» (${result.code})`,
        createdAt: linkCode.createdAt,
      };
      set({
        linkCodes: [linkCode, ...state.linkCodes],
        auditLogs: [log, ...state.auditLogs],
      });
      return linkCode;
    }

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
      details: `تولید کد اتصال تلگرام برای «${contact.displayName}»`,
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

    if (state.realMode) {
      await revokeTelegramLinkInSupabase(id);
    }

    const updated: TelegramLink = {
      ...link,
      status: "revoked",
      revokedAt: new Date().toISOString(),
    };
    const contact = state.contacts.find((c) => c.id === link.contactId);
    const log: AuditLogEntry = {
      id: uid("audit"),
      actorId: state.realMode ? "real" : "owner",
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

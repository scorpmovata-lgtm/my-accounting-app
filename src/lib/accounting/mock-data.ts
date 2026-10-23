// داده موک برای پروتوتایپ — فقط برای نسخه نمایشی
// در نسخه واقعی، این داده از Supabase خوانده می‌شود.

import type {
  AuditLogEntry,
  Category,
  Contact,
  Ledger,
  TelegramLink,
  Transaction,
} from "./types";

// تاریخ N روز پیش به ISO
function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d.toISOString();
}

// تاریخ N روز پیش فقط بخش yyyy-mm-dd
function daysAgoDateOnly(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

export const seedLedger: Ledger = {
  id: "ledger-1",
  ownerName: "علی رضایی",
  name: "دفتر شخصی علی",
  defaultCurrency: "IRT",
  createdAt: daysAgo(120),
};

export const seedContacts: Contact[] = [
  {
    id: "contact-1",
    ledgerId: "ledger-1",
    displayName: "مریم احمدی",
    notes: "شریک تجاری",
    linkedTelegramId: "tg-1045298132",
    linkedProfileId: null,
    createdAt: daysAgo(118),
  },
  {
    id: "contact-2",
    ledgerId: "ledger-1",
    displayName: "رضا کریمی",
    notes: "فروشنده کالا",
    linkedTelegramId: null,
    createdAt: daysAgo(115),
  },
  {
    id: "contact-3",
    ledgerId: "ledger-1",
    displayName: "سارا موسوی",
    notes: "قرض",
    linkedTelegramId: null,
    createdAt: daysAgo(90),
  },
  {
    id: "contact-4",
    ledgerId: "ledger-1",
    displayName: "محمد قاسمی",
    notes: "",
    linkedTelegramId: null,
    createdAt: daysAgo(60),
  },
];

export const seedCategories: Category[] = [
  {
    id: "cat-1",
    ledgerId: "ledger-1",
    name: "کالا",
    isActive: true,
    sortOrder: 1,
    createdAt: daysAgo(118),
  },
  {
    id: "cat-2",
    ledgerId: "ledger-1",
    name: "قرض",
    isActive: true,
    sortOrder: 2,
    createdAt: daysAgo(118),
  },
  {
    id: "cat-3",
    ledgerId: "ledger-1",
    name: "خدمات",
    isActive: true,
    sortOrder: 3,
    createdAt: daysAgo(118),
  },
  {
    id: "cat-4",
    ledgerId: "ledger-1",
    name: "اجاره",
    isActive: true,
    sortOrder: 4,
    createdAt: daysAgo(118),
  },
  {
    id: "cat-5",
    ledgerId: "ledger-1",
    name: "سایر",
    isActive: true,
    sortOrder: 99,
    createdAt: daysAgo(118),
  },
];

// سناریوها (طبق سند مرحله صفر):
//   ۴.۴: ایجاد طلب ۵ میلیون به مریم + دریافت ۲ میلیون → طلب باز ۳ میلیون
//   ۴.۵: ایجاد بدهی ۱.۲ میلیون به رضا + پرداخت ۷۰۰ هزار → بدهی باز ۵۰۰ هزار
//   ۴.۶: هم‌زمان طلب ۵ میلیون و بدهی ۴ میلیون به سارا → هر دو جدا می‌مانند
export const seedTransactions: Transaction[] = [
  // مریم: سناریوی ۴.۴
  {
    id: "tx-1",
    ledgerId: "ledger-1",
    contactId: "contact-1",
    categoryId: "cat-1",
    transactionType: "RECEIVABLE_CHARGE",
    amount: 5_000_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(40),
    createdAt: daysAgo(40),
    createdBy: "owner",
    description: "فروش کالا به مریم",
    status: "POSTED",
    idempotencyKey: "idem-1",
  },
  {
    id: "tx-2",
    ledgerId: "ledger-1",
    contactId: "contact-1",
    categoryId: "cat-1",
    transactionType: "RECEIPT_ALLOCATION",
    amount: 2_000_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(20),
    createdAt: daysAgo(20),
    createdBy: "owner",
    description: "دریافت بخشی از طلب",
    status: "POSTED",
    idempotencyKey: "idem-2",
  },
  // رضا: سناریوی ۴.۵
  {
    id: "tx-3",
    ledgerId: "ledger-1",
    contactId: "contact-2",
    categoryId: "cat-2",
    transactionType: "PAYABLE_CHARGE",
    amount: 1_200_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(35),
    createdAt: daysAgo(35),
    createdBy: "owner",
    description: "قرض از رضا",
    status: "POSTED",
    idempotencyKey: "idem-3",
  },
  {
    id: "tx-4",
    ledgerId: "ledger-1",
    contactId: "contact-2",
    categoryId: "cat-2",
    transactionType: "PAYMENT_ALLOCATION",
    amount: 700_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(15),
    createdAt: daysAgo(15),
    createdBy: "owner",
    description: "پرداخت بخشی از قرض",
    status: "POSTED",
    idempotencyKey: "idem-4",
  },
  // سارا: سناریوی ۴.۶ (هم‌زمان طلب و بدهی، بدون تهاتر)
  {
    id: "tx-5",
    ledgerId: "ledger-1",
    contactId: "contact-3",
    categoryId: "cat-1",
    transactionType: "RECEIVABLE_CHARGE",
    amount: 5_000_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(25),
    createdAt: daysAgo(25),
    createdBy: "owner",
    description: "فروش کالا به سارا",
    status: "POSTED",
    idempotencyKey: "idem-5",
  },
  {
    id: "tx-6",
    ledgerId: "ledger-1",
    contactId: "contact-3",
    categoryId: "cat-2",
    transactionType: "PAYABLE_CHARGE",
    amount: 4_000_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(22),
    createdAt: daysAgo(22),
    createdBy: "owner",
    description: "قرض از سارا",
    status: "POSTED",
    idempotencyKey: "idem-6",
  },
  // محمد: یک طلب باز خالص
  {
    id: "tx-7",
    ledgerId: "ledger-1",
    contactId: "contact-4",
    categoryId: "cat-3",
    transactionType: "OPENING_RECEIVABLE",
    amount: 1_500_000,
    currency: "IRT",
    effectiveAt: daysAgoDateOnly(60),
    createdAt: daysAgo(60),
    createdBy: "owner",
    description: "مانده اولیه طلب",
    status: "POSTED",
    idempotencyKey: "idem-7",
  },
];

export const seedAuditLogs: AuditLogEntry[] = [
  {
    id: "audit-1",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-1",
    result: "success",
    details: "ایجاد طلب ۵٬۰۰۰٬۰۰۰ تومان برای مریم احمدی",
    createdAt: daysAgo(40),
  },
  {
    id: "audit-2",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-2",
    result: "success",
    details: "دریافت ۲٬۰۰۰٬۰۰۰ تومان از مریم احمدی",
    createdAt: daysAgo(20),
  },
  {
    id: "audit-3",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-3",
    result: "success",
    details: "ایجاد بدهی ۱٬۲۰۰٬۰۰۰ تومان به رضا کریمی",
    createdAt: daysAgo(35),
  },
  {
    id: "audit-4",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-4",
    result: "success",
    details: "پرداخت ۷۰۰٬۰۰۰ تومان به رضا کریمی",
    createdAt: daysAgo(15),
  },
  {
    id: "audit-5",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-5",
    result: "success",
    details: "ایجاد طلب ۵٬۰۰۰٬۰۰۰ تومان برای سارا موسوی",
    createdAt: daysAgo(25),
  },
  {
    id: "audit-6",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-6",
    result: "success",
    details: "ایجاد بدهی ۴٬۰۰۰٬۰۰۰ تومان به سارا موسوی",
    createdAt: daysAgo(22),
  },
  {
    id: "audit-7",
    actorId: "owner",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-7",
    result: "success",
    details: "ثبت مانده اولیه طلب ۱٬۵۰۰٬۰۰۰ تومان برای محمد قاسمی",
    createdAt: daysAgo(60),
  },
];

export const seedTelegramLinks: TelegramLink[] = [
  {
    id: "tg-link-1",
    contactId: "contact-1",
    telegramUserId: "1045298132",
    telegramUsername: "@maryam_ahmadi",
    status: "linked",
    scope: "balance_only",
    linkedAt: daysAgo(50),
    createdAt: daysAgo(55),
  },
];

// داده موک برای دفتر حسابداری چندکاربری — نسخه ۲.۰
// سناریوی نمایشی: وحید (ادمین = کاربر A) و فائزه (کاربر B با دسترسی تراکنش‌ها)
//
// تاریخچه (به ترتیب زمانی شمسی):
//   ۱۴۰۵/۶/۲۰  — وحید ۱.۵M به رضا وام داد         → طلب ۱.۵M (رضا شخص عادی، بدون تطابق)
//   ۱۴۰۵/۷/۱   — فائزه ۸۰۰k از سارا دریافت کرد     → بدهی ۸۰۰k (سارا شخص عادی)
//   ۱۴۰۵/۷/۱۵  — فائزه ۲M به وحید وام داد          → وحید بدهی ۲M / فائزه طلب ۲M  ✓ تطبیق
//   ۱۴۰۵/۷/۲۰  — وحید ۳۰۰k به مریم پرداخت           → وحید طلب ۳۰۰k / مریم بدهی ۳۰۰k ✓ تطبیق
//   ۱۴۰۵/۸/۴   — وحید ۱M به فائزه پرداخت (قسط)      → وحید بدهی ۱M / فائزه طلب ۱M  ✓ تطبیق
//   ۱۴۰۵/۸/۱۰  — وحید ۵۰۰k به فائزه پرداخت (اضافه)  → در انتظار طرف مقابل (فائزه هنوز ثبت نکرده)
//
// مانده نهایی:
//   وحید (A): طلب ۱.۵M (رضا) + طلب ۳۰۰k (مریم) = طلب ۱.۸M؛ بدهی ۵۰۰k (فائزه) → خالص طلب ۱.۳M
//   فائزه (B): طلب ۱M (وحید) [ pending 500k را نمی‌بیند]؛ بدهی ۸۰۰k (سارا) → خالص طلب ۲۰۰k
//   مریم (C): بدهی ۳۰۰k (وحید)

import type {
  AuditLogEntry,
  Counterparty,
  Transaction,
  User,
} from "./types";

// ISO با زمان ثابت (برای پایداری seed)
function isoAt(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// کاربران
// ---------------------------------------------------------------------------

export const seedUsers: User[] = [
  {
    id: "user-a",
    username: "vahid",
    password: "1234",
    displayName: "وحید",
    role: "admin",
    linkedCounterpartyId: "cp-vahid",
    createdAt: isoAt(130),
  },
  {
    id: "user-b",
    username: "faezeh",
    password: "1234",
    displayName: "فائزه",
    role: "user",
    scope: "transaction_list",
    linkedCounterpartyId: "cp-faezeh",
    createdAt: isoAt(128),
  },
  {
    id: "user-c",
    username: "maryam",
    password: "1234",
    displayName: "مریم",
    role: "user",
    scope: "balance_only",
    linkedCounterpartyId: "cp-maryam",
    createdAt: isoAt(100),
  },
];

// ---------------------------------------------------------------------------
// طرف حساب‌ها (متمرکز — فقط ادمین ساخته)
// ---------------------------------------------------------------------------

export const seedCounterparties: Counterparty[] = [
  {
    id: "cp-vahid",
    displayName: "وحید",
    notes: "ادمین سامانه",
    linkedUserId: "user-a",
    linkedUsername: "vahid",
    createdBy: "user-a",
    createdAt: isoAt(129),
  },
  {
    id: "cp-faezeh",
    displayName: "فائزه",
    notes: "کاربر با دسترسی تراکنش‌ها",
    linkedUserId: "user-b",
    linkedUsername: "faezeh",
    createdBy: "user-a",
    createdAt: isoAt(127),
  },
  {
    id: "cp-maryam",
    displayName: "مریم احمدی",
    notes: "کاربر با دسترسی فقط مانده",
    linkedUserId: "user-c",
    linkedUsername: "maryam",
    createdBy: "user-a",
    createdAt: isoAt(99),
  },
  {
    id: "cp-reza",
    displayName: "رضا کریمی",
    notes: "فروشنده کالا",
    linkedUserId: null,
    linkedUsername: null,
    createdBy: "user-a",
    createdAt: isoAt(125),
  },
  {
    id: "cp-sara",
    displayName: "سارا موسوی",
    notes: "",
    linkedUserId: null,
    linkedUsername: null,
    createdBy: "user-a",
    createdAt: isoAt(90),
  },
];

// ---------------------------------------------------------------------------
// تراکنش‌ها
// ---------------------------------------------------------------------------

export const seedTransactions: Transaction[] = [
  // ۱۴۰۵/۶/۲۰ — وحید ۱.۵M به رضا وام داد (شخص عادی، بدون تطابق)
  {
    id: "tx-a4",
    userId: "user-a",
    counterpartyId: "cp-reza",
    direction: "paid_to",
    amount: 1_500_000,
    currency: "IRT",
    effectiveAt: "1405-06-20",
    createdAt: isoAt(110),
    createdBy: "user-a",
    description: "وام به رضا",
    status: "POSTED",
    matchedTransactionId: null,
    matchStatus: "unmatched",
    idempotencyKey: "idem-a4",
  },
  // ۱۴۰۵/۷/۱ — فائزه ۸۰۰k از سارا دریافت کرد (شخص عادی)
  {
    id: "tx-b3",
    userId: "user-b",
    counterpartyId: "cp-sara",
    direction: "received_from",
    amount: 800_000,
    currency: "IRT",
    effectiveAt: "1405-07-01",
    createdAt: isoAt(95),
    createdBy: "user-b",
    description: "دریافت از سارا",
    status: "POSTED",
    matchedTransactionId: null,
    matchStatus: "unmatched",
    idempotencyKey: "idem-b3",
  },
  // ۱۴۰۵/۷/۱۵ — فائزه ۲M به وحید وام داد  ✓ زوج تطبیق
  {
    id: "tx-a1",
    userId: "user-a",
    counterpartyId: "cp-faezeh",
    direction: "received_from",
    amount: 2_000_000,
    currency: "IRT",
    effectiveAt: "1405-07-15",
    createdAt: isoAt(80),
    createdBy: "user-a",
    description: "وام از فائزه",
    status: "POSTED",
    matchedTransactionId: "tx-b1",
    matchStatus: "matched",
    idempotencyKey: "idem-a1",
  },
  {
    id: "tx-b1",
    userId: "user-b",
    counterpartyId: "cp-vahid",
    direction: "paid_to",
    amount: 2_000_000,
    currency: "IRT",
    effectiveAt: "1405-07-15",
    createdAt: isoAt(80),
    createdBy: "user-b",
    description: "وام به وحید",
    status: "POSTED",
    matchedTransactionId: "tx-a1",
    matchStatus: "matched",
    idempotencyKey: "idem-b1",
  },
  // ۱۴۰۵/۷/۲۰ — وحید ۳۰۰k به مریم پرداخت  ✓ زوج تطبیق
  {
    id: "tx-a5",
    userId: "user-a",
    counterpartyId: "cp-maryam",
    direction: "paid_to",
    amount: 300_000,
    currency: "IRT",
    effectiveAt: "1405-07-20",
    createdAt: isoAt(75),
    createdBy: "user-a",
    description: "هدیه به مریم",
    status: "POSTED",
    matchedTransactionId: "tx-c1",
    matchStatus: "matched",
    idempotencyKey: "idem-a5",
  },
  {
    id: "tx-c1",
    userId: "user-c",
    counterpartyId: "cp-vahid",
    direction: "received_from",
    amount: 300_000,
    currency: "IRT",
    effectiveAt: "1405-07-20",
    createdAt: isoAt(75),
    createdBy: "user-c",
    description: "دریافت هدیه از وحید",
    status: "POSTED",
    matchedTransactionId: "tx-a5",
    matchStatus: "matched",
    idempotencyKey: "idem-c1",
  },
  // ۱۴۰۵/۸/۴ — وحید ۱M به فائزه پرداخت (قسط)  ✓ زوج تطبیق
  {
    id: "tx-a2",
    userId: "user-a",
    counterpartyId: "cp-faezeh",
    direction: "paid_to",
    amount: 1_000_000,
    currency: "IRT",
    effectiveAt: "1405-08-04",
    createdAt: isoAt(60),
    createdBy: "user-a",
    description: "پرداخت قسط وام",
    status: "POSTED",
    matchedTransactionId: "tx-b2",
    matchStatus: "matched",
    idempotencyKey: "idem-a2",
  },
  {
    id: "tx-b2",
    userId: "user-b",
    counterpartyId: "cp-vahid",
    direction: "received_from",
    amount: 1_000_000,
    currency: "IRT",
    effectiveAt: "1405-08-04",
    createdAt: isoAt(60),
    createdBy: "user-b",
    description: "دریافت قسط از وحید",
    status: "POSTED",
    matchedTransactionId: "tx-a2",
    matchStatus: "matched",
    idempotencyKey: "idem-b2",
  },
  // ۱۴۰۵/۸/۱۰ — وحید ۵۰۰k به فائزه پرداخت (طرف مقابل هنوز ثبت نکرده) → در انتظار
  {
    id: "tx-a3",
    userId: "user-a",
    counterpartyId: "cp-faezeh",
    direction: "paid_to",
    amount: 500_000,
    currency: "IRT",
    effectiveAt: "1405-08-10",
    createdAt: isoAt(54),
    createdBy: "user-a",
    description: "پرداخت اضافه (فائزه هنوز ثبت نکرده)",
    status: "POSTED",
    matchedTransactionId: null,
    matchStatus: "pending",
    idempotencyKey: "idem-a3",
  },
];

// ---------------------------------------------------------------------------
// گزارش‌های ممیزی seed
// ---------------------------------------------------------------------------

export const seedAuditLogs: AuditLogEntry[] = [
  {
    id: "audit-1",
    actorId: "user-a",
    actorName: "وحید",
    action: "ADD_COUNTERPARTY",
    entityType: "Counterparty",
    entityId: "cp-reza",
    result: "success",
    details: "افزودن طرف حساب «رضا کریمی»",
    createdAt: isoAt(125),
  },
  {
    id: "audit-2",
    actorId: "user-a",
    actorName: "وحید",
    action: "ADD_COUNTERPARTY",
    entityType: "Counterparty",
    entityId: "cp-faezeh",
    result: "success",
    details: "افزودن طرف حساب «فائزه» (لینک به کاربر faezeh)",
    createdAt: isoAt(127),
  },
  {
    id: "audit-3",
    actorId: "user-a",
    actorName: "وحید",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-a1",
    result: "success",
    details: "ثبت «دریافت ۲٬۰۰۰٬۰۰۰ تومان از فائزه» — تطبیق‌یافته با tx-b1",
    createdAt: isoAt(80),
  },
  {
    id: "audit-4",
    actorId: "user-b",
    actorName: "فائزه",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-b2",
    result: "success",
    details: "ثبت «دریافت ۱٬۰۰۰٬۰۰۰ تومان از وحید» — تطبیق‌یافته با tx-a2",
    createdAt: isoAt(60),
  },
  {
    id: "audit-5",
    actorId: "user-a",
    actorName: "وحید",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-a3",
    result: "success",
    details: "ثبت «پرداخت ۵۰۰٬۰۰۰ تومان به فائزه» — در انتظار طرف مقابل",
    createdAt: isoAt(54),
  },
];

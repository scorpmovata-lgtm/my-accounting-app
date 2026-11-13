// داده موک برای دفتر حسابداری چندکاربری — نسخه ۳.۰ (دفترهای مستقل + دید دوجانبه)
// سناریوی نمایشی: وحید (ادمین)، فائزه (کاربر با تراکنش‌ها)، مریم (فقط مانده)
// + رضا/علی/حمید: طرف‌حساب‌های مشترک بدون پنل کاربری
// + تعمیرکار: طرف‌حساب شخصی فائزه (فقط در دفتر خودش)
//
// تاریخچه شمسی:
//   ۱۴۰۵/۶/۲۰  — وحید: طلب اولیه ۱.۵M از رضا (وام)
//   ۱۴۰۵/۷/۱   — فائزه: بدهی اولیه ۸۰۰k به علی (خرید نسیه)
//   ۱۴۰۵/۷/۱۵  — فائزه: ثبت طلب ۲M از وحید (وام به وحید)  ← وحید این را در «حساب دیگران» می‌بیند
//   ۱۴۰۵/۷/۱۵  — وحید: ثبت بدهی ۲M به فائزه (وام گرفتن)     ← آینه همان رویداد، در دفتر خودش
//   ۱۴۰۵/۷/۲۰  — وحید: پرداخت ۳۰۰k به مریم (هدیه)
//   ۱۴۰۵/۸/۴   — وحید: پرداخت ۱M به فائزه (قسط) + فائزه: دریافت ۱M از وحید (آینه)
//   ۱۴۰۵/۸/۱۰  — فائزه: پرداخت ۵۰۰k به رضا (خرید لوازم)
//   ۱۴۰۵/۸/۱۲  — فائزه: بدهی اولیه ۲۰۰k به تعمیرکار (طرف‌حساب شخصی)
//
// مانده نهایی:
//   وحید: طلب ۱.۵M (رضا) + طلب ۳۰۰k (مریم) = ۱.۸M؛ بدهی ۱M (فائزه) → خالص طلب ۸۰۰k
//   فائزه: طلب ۱M (وحید) + طلب ۵۰۰k (رضا) = ۱.۵M؛ بدهی ۸۰۰k (علی) + ۲۰۰k (تعمیرکار) = ۱M → خالص طلب ۵۰۰k
//   مریم: بدون تراکنش ثبت‌شده خودش

import type {
  AccessGrant,
  AuditLogEntry,
  Category,
  Counterparty,
  TxnComment,
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
    isActive: true,
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
    isActive: true,
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
    isActive: true,
    createdAt: isoAt(100),
  },
];

// ---------------------------------------------------------------------------
// طرف حساب‌ها — مشترک (ادمین) + شخصی (کاربر)
// ---------------------------------------------------------------------------

export const seedCounterparties: Counterparty[] = [
  {
    id: "cp-vahid",
    displayName: "وحید",
    notes: "ادمین سامانه",
    linkedUserId: "user-a",
    linkedUsername: "vahid",
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(129),
  },
  {
    id: "cp-faezeh",
    displayName: "فائزه",
    notes: "کاربر با دسترسی تراکنش‌ها",
    linkedUserId: "user-b",
    linkedUsername: "faezeh",
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(127),
  },
  {
    id: "cp-maryam",
    displayName: "مریم احمدی",
    notes: "کاربر با دسترسی فقط مانده",
    linkedUserId: "user-c",
    linkedUsername: "maryam",
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(99),
  },
  {
    id: "cp-reza",
    displayName: "رضا کریمی",
    notes: "فروشنده کالا (بدون پنل کاربری)",
    linkedUserId: null,
    linkedUsername: null,
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(125),
  },
  {
    id: "cp-ali",
    displayName: "علی رحیمی",
    notes: "بدون پنل کاربری",
    linkedUserId: null,
    linkedUsername: null,
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(90),
  },
  {
    id: "cp-hamid",
    displayName: "حمید صادقی",
    notes: "بدون پنل کاربری — می‌توان بعداً پنل داد",
    linkedUserId: null,
    linkedUsername: null,
    isShared: true,
    ownerUserId: null,
    createdBy: "user-a",
    createdAt: isoAt(88),
  },
  // طرف‌حساب شخصی فائزه — فقط در دفتر خودش
  {
    id: "cp-faezeh-private-1",
    displayName: "تعمیرکار خانه",
    notes: "طرف‌حساب شخصی — فقط دفتر خودم",
    linkedUserId: null,
    linkedUsername: null,
    isShared: false,
    ownerUserId: "user-b",
    createdBy: "user-b",
    createdAt: isoAt(60),
  },
];

// ---------------------------------------------------------------------------
// دسته‌بندی‌های شخصی
//   counterpartyId === null/undefined → عمومی (همه طرف‌حساب‌ها)
//   counterpartyId پر شده → مخصوص همان طرف‌حساب
// ---------------------------------------------------------------------------

export const seedCategories: Category[] = [
  // وحید: عمومی‌ها
  { id: "cat-a1", userId: "user-a", name: "وام", createdAt: isoAt(120), counterpartyId: null },
  { id: "cat-a2", userId: "user-a", name: "قسط", createdAt: isoAt(120), counterpartyId: null },
  { id: "cat-a3", userId: "user-a", name: "هدیه", createdAt: isoAt(119), counterpartyId: null },
  // وحید: مخصوص فائزه — کارهای مربوط به قرض‌های بین‌النوعی
  { id: "cat-a4", userId: "user-a", name: "خرید مشترک", createdAt: isoAt(115), counterpartyId: "cp-faezeh" },
  // فائزه: عمومی‌ها
  { id: "cat-b1", userId: "user-b", name: "قرض", createdAt: isoAt(118), counterpartyId: null },
  { id: "cat-b2", userId: "user-b", name: "خرید", createdAt: isoAt(118), counterpartyId: null },
  { id: "cat-b3", userId: "user-b", name: "اجاره", createdAt: isoAt(118), counterpartyId: null },
  // فائزه: مخصوص وحید
  { id: "cat-b4", userId: "user-b", name: "تعاونی", createdAt: isoAt(116), counterpartyId: "cp-vahid" },
];

// ---------------------------------------------------------------------------
// اجازه دسترسی به طرف‌حساب‌های مشترک (گرنت — فقط ادمین می‌دهد)
// ---------------------------------------------------------------------------

export const seedGrants: AccessGrant[] = [
  // فائزه: به وحید، رضا، علی و حمید دسترسی دارد
  { id: "gr-1", userId: "user-b", counterpartyId: "cp-vahid", grantedBy: "user-a", createdAt: isoAt(126) },
  { id: "gr-2", userId: "user-b", counterpartyId: "cp-reza", grantedBy: "user-a", createdAt: isoAt(126) },
  { id: "gr-3", userId: "user-b", counterpartyId: "cp-ali", grantedBy: "user-a", createdAt: isoAt(126) },
  { id: "gr-4", userId: "user-b", counterpartyId: "cp-hamid", grantedBy: "user-a", createdAt: isoAt(126) },
  // وحید: فائزه، مریم و رضا
  { id: "gr-5", userId: "user-a", counterpartyId: "cp-faezeh", grantedBy: "user-a", createdAt: isoAt(125) },
  { id: "gr-6", userId: "user-a", counterpartyId: "cp-maryam", grantedBy: "user-a", createdAt: isoAt(125) },
  { id: "gr-7", userId: "user-a", counterpartyId: "cp-reza", grantedBy: "user-a", createdAt: isoAt(125) },
  // مریم: فقط وحید
  { id: "gr-8", userId: "user-c", counterpartyId: "cp-vahid", grantedBy: "user-a", createdAt: isoAt(98) },
];

// ---------------------------------------------------------------------------
// تراکنش‌ها (kind-based — بدون تطابق)
// ---------------------------------------------------------------------------

export const seedTransactions: Transaction[] = [
  // ۱۴۰۵/۶/۲۰ — وحید: طلب اولیه ۱.۵M از رضا
  {
    id: "tx-a1",
    userId: "user-a",
    counterpartyId: "cp-reza",
    kind: "opening_claim",
    amount: 1_500_000,
    currency: "IRT",
    effectiveAt: "1405-06-20",
    createdAt: isoAt(110),
    createdBy: "user-a",
    description: "موجودی اولیه — وام به رضا",
    categoryId: "cat-a1",
    status: "POSTED",
    idempotencyKey: "idem-a1",
  },
  // ۱۴۰۵/۷/۱ — فائزه: بدهی اولیه ۸۰۰k به علی
  {
    id: "tx-b3",
    userId: "user-b",
    counterpartyId: "cp-ali",
    kind: "opening_debt",
    amount: 800_000,
    currency: "IRT",
    effectiveAt: "1405-07-01",
    createdAt: isoAt(95),
    createdBy: "user-b",
    description: "موجودی اولیه — خرید نسیه از علی",
    categoryId: "cat-b2",
    status: "POSTED",
    idempotencyKey: "idem-b3",
  },
  // ۱۴۰۵/۷/۱۵ — فائزه: ثبت طلب ۲M از وحید (وام به وحید)
  {
    id: "tx-b1",
    userId: "user-b",
    counterpartyId: "cp-vahid",
    kind: "claim",
    amount: 2_000_000,
    currency: "IRT",
    effectiveAt: "1405-07-15",
    createdAt: isoAt(80),
    createdBy: "user-b",
    description: "وام به وحید — سررسید پایان ماه",
    categoryId: "cat-b1",
    status: "POSTED",
    idempotencyKey: "idem-b1",
  },
  // ۱۴۰۵/۷/۱۵ — وحید: ثبت بدهی ۲M به فائزه (آینه همان رویداد، در دفتر خودش)
  {
    id: "tx-a2",
    userId: "user-a",
    counterpartyId: "cp-faezeh",
    kind: "debt",
    amount: 2_000_000,
    currency: "IRT",
    effectiveAt: "1405-07-15",
    createdAt: isoAt(80, 11),
    createdBy: "user-a",
    description: "وام گرفتن از فائزه",
    categoryId: "cat-a1",
    status: "POSTED",
    idempotencyKey: "idem-a2",
  },
  // ۱۴۰۵/۷/۲۰ — وحید: پرداخت ۳۰۰k به مریم (هدیه)
  {
    id: "tx-a4",
    userId: "user-a",
    counterpartyId: "cp-maryam",
    kind: "paid_to",
    amount: 300_000,
    currency: "IRT",
    effectiveAt: "1405-07-20",
    createdAt: isoAt(75),
    createdBy: "user-a",
    description: "هدیه به مریم",
    categoryId: "cat-a3",
    status: "POSTED",
    idempotencyKey: "idem-a4",
  },
  // ۱۴۰۵/۸/۴ — وحید: پرداخت ۱M به فائزه (قسط)
  {
    id: "tx-a3",
    userId: "user-a",
    counterpartyId: "cp-faezeh",
    kind: "paid_to",
    amount: 1_000_000,
    currency: "IRT",
    effectiveAt: "1405-08-04",
    createdAt: isoAt(60),
    createdBy: "user-a",
    description: "پرداخت قسط اول وام",
    categoryId: "cat-a2",
    status: "POSTED",
    idempotencyKey: "idem-a3",
  },
  // ۱۴۰۵/۸/۴ — فائزه: دریافت ۱M از وحید (آینه)
  {
    id: "tx-b2",
    userId: "user-b",
    counterpartyId: "cp-vahid",
    kind: "received_from",
    amount: 1_000_000,
    currency: "IRT",
    effectiveAt: "1405-08-04",
    createdAt: isoAt(60, 12),
    createdBy: "user-b",
    description: "دریافت قسط اول از وحید",
    categoryId: "cat-b1",
    status: "POSTED",
    idempotencyKey: "idem-b2",
  },
  // ۱۴۰۵/۸/۱۰ — فائزه: پرداخت ۵۰۰k به رضا (خرید لوازم)
  {
    id: "tx-b4",
    userId: "user-b",
    counterpartyId: "cp-reza",
    kind: "paid_to",
    amount: 500_000,
    currency: "IRT",
    effectiveAt: "1405-08-10",
    createdAt: isoAt(54),
    createdBy: "user-b",
    description: "خرید لوازم خانه از رضا",
    categoryId: "cat-b2",
    status: "POSTED",
    idempotencyKey: "idem-b4",
  },
  // ۱۴۰۵/۸/۱۲ — فائزه: بدهی اولیه ۲۰۰k به تعمیرکار (طرف‌حساب شخصی)
  {
    id: "tx-b5",
    userId: "user-b",
    counterpartyId: "cp-faezeh-private-1",
    kind: "opening_debt",
    amount: 200_000,
    currency: "IRT",
    effectiveAt: "1405-08-12",
    createdAt: isoAt(50),
    createdBy: "user-b",
    description: "موجودی اولیه — هزینه تعمیر",
    categoryId: null,
    status: "POSTED",
    idempotencyKey: "idem-b5",
  },
];

// ---------------------------------------------------------------------------
// کامنت‌ها روی ردیف‌های تراکنش (دوطرفه)
// ---------------------------------------------------------------------------

export const seedComments: TxnComment[] = [
  {
    id: "cm-1",
    transactionId: "tx-b1", // فائزه: ثبت طلب ۲M از وحید
    authorId: "user-a",
    authorName: "وحید",
    body: "درسته، وام رو گرفتم. تا آخر ماه پس می‌دم ✓",
    createdAt: isoAt(79),
  },
  {
    id: "cm-2",
    transactionId: "tx-b1",
    authorId: "user-b",
    authorName: "فائزه",
    body: "ممنون! سررسید پایان ماهه، مبلغ دقیق همین ۲M",
    createdAt: isoAt(78),
  },
  {
    id: "cm-3",
    transactionId: "tx-a3", // وحید: پرداخت قسط ۱M به فائزه
    authorId: "user-b",
    authorName: "فائزه",
    body: "قسط اول دریافت شد ✓",
    createdAt: isoAt(59),
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
    details: "افزودن طرف حساب مشترک «رضا کریمی» (بدون پنل)",
    createdAt: isoAt(125),
  },
  {
    id: "audit-2",
    actorId: "user-a",
    actorName: "وحید",
    action: "GRANT_CP_ACCESS",
    entityType: "CounterpartyAccess",
    entityId: "gr-1",
    result: "success",
    details: "دادن دسترسی «وحید» به فائزه",
    createdAt: isoAt(126),
  },
  {
    id: "audit-3",
    actorId: "user-b",
    actorName: "فائزه",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-b1",
    result: "success",
    details: "ثبت «ثبت طلب ۲٬۰۰۰٬۰۰۰ تومان از وحید» در دفتر خودش",
    createdAt: isoAt(80),
  },
  {
    id: "audit-4",
    actorId: "user-a",
    actorName: "وحید",
    action: "CREATE_TXN",
    entityType: "Transaction",
    entityId: "tx-a3",
    result: "success",
    details: "ثبت «پرداخت ۱٬۰۰۰٬۰۰۰ تومان به فائزه» — دسته: قسط",
    createdAt: isoAt(60),
  },
];

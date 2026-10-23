// موتور حسابداری — محاسبه مانده طلب و بدهی ناخالص به‌صورت جداگانه
// اصول پیاده‌سازی‌شده:
//   - طلب و بدهی ناخالص جداگانه محاسبه می‌شوند؛ تهاتر خودکار ممنوع است.
//   - مانده از تراکنش‌های POSTED مشتق می‌شود (هیچ عدد ذخیره‌شده‌ای معتبر نیست).
//   - دریافت/پرداخت نباید از مانده باز بیشتر باشد (نسخه ۱: رد شود).
//   - تراکنش‌های REVERSED در محاسبه لحاظ نمی‌شوند.

import {
  Transaction,
  TransactionType,
  TRANSACTION_EFFECT,
} from "./types";

export interface ContactBalance {
  contactId: string;
  // طلب باز از این شخص (ناخالص)
  outstandingReceivable: number;
  // بدهی باز به این شخص (ناخالص)
  outstandingPayable: number;
  // آمار کل (برای گزارش)
  totalChargedReceivable: number;
  totalChargedPayable: number;
  totalReceived: number;
  totalPaid: number;
  // تعداد تراکنش‌های فعال
  transactionCount: number;
}

export interface LedgerBalance {
  byContact: ContactBalance[];
  totalOutstandingReceivable: number;
  totalOutstandingPayable: number;
  totalReceived: number;
  totalPaid: number;
  // خالص محاسباتی — فقط به‌عنوان شاخص کمکی؛ بدون تهاتر حقوقی/عملیاتی
  netComputed: number;
}

// فیلتر کردن تراکنش‌های فعال دفتر
export function getPostedTransactions(
  transactions: Transaction[]
): Transaction[] {
  return transactions.filter((t) => t.status === "POSTED");
}

// محاسبه مانده برای یک مخاطب مشخص
export function computeContactBalance(
  contactId: string,
  transactions: Transaction[]
): ContactBalance {
  const relevant = transactions.filter(
    (t) => t.contactId === contactId && t.status === "POSTED"
  );

  let outstandingReceivable = 0;
  let outstandingPayable = 0;
  let totalChargedReceivable = 0;
  let totalChargedPayable = 0;
  let totalReceived = 0;
  let totalPaid = 0;

  for (const t of relevant) {
    const effect = TRANSACTION_EFFECT[t.transactionType];
    if (effect.receivable === 1) {
      outstandingReceivable += t.amount;
      if (
        t.transactionType === "RECEIVABLE_CHARGE" ||
        t.transactionType === "OPENING_RECEIVABLE"
      ) {
        totalChargedReceivable += t.amount;
      }
    } else if (effect.receivable === -1) {
      outstandingReceivable -= t.amount;
      totalReceived += t.amount;
    }
    if (effect.payable === 1) {
      outstandingPayable += t.amount;
      if (
        t.transactionType === "PAYABLE_CHARGE" ||
        t.transactionType === "OPENING_PAYABLE"
      ) {
        totalChargedPayable += t.amount;
      }
    } else if (effect.payable === -1) {
      outstandingPayable -= t.amount;
      totalPaid += t.amount;
    }
  }

  return {
    contactId,
    outstandingReceivable,
    outstandingPayable,
    totalChargedReceivable,
    totalChargedPayable,
    totalReceived,
    totalPaid,
    transactionCount: relevant.length,
  };
}

// محاسبه مانده کل دفتر
export function computeLedgerBalance(
  transactions: Transaction[]
): LedgerBalance {
  const posted = getPostedTransactions(transactions);
  const contactIds = Array.from(new Set(posted.map((t) => t.contactId)));
  const byContact = contactIds.map((id) =>
    computeContactBalance(id, posted)
  );

  const totalOutstandingReceivable = byContact.reduce(
    (s, c) => s + c.outstandingReceivable,
    0
  );
  const totalOutstandingPayable = byContact.reduce(
    (s, c) => s + c.outstandingPayable,
    0
  );

  return {
    byContact,
    totalOutstandingReceivable,
    totalOutstandingPayable,
    totalReceived: byContact.reduce((s, c) => s + c.totalReceived, 0),
    totalPaid: byContact.reduce((s, c) => s + c.totalPaid, 0),
    // فقط شاخص کمکی؛ در UI با هشدار نمایش داده می‌شود
    netComputed: totalOutstandingReceivable - totalOutstandingPayable,
  };
}

// اعتبارسنجی: آیا دریافت مجاز است؟
export function validateReceipt(
  contactId: string,
  amount: number,
  transactions: Transaction[]
): { ok: boolean; error?: string } {
  if (amount <= 0) {
    return { ok: false, error: "مبلغ دریافت باید مثبت باشد." };
  }
  const balance = computeContactBalance(contactId, transactions);
  if (amount > balance.outstandingReceivable) {
    return {
      ok: false,
      error: `دریافت ${amount.toLocaleString(
        "en-US"
      )} تومان از طلب باز ${balance.outstandingReceivable.toLocaleString(
        "en-US"
      )} تومان بیشتر است. در نسخه ۱، دریافت بیش از طلب قابل تخصیص رد می‌شود.`,
    };
  }
  return { ok: true };
}

// اعتبارسنجی: آیا پرداخت مجاز است؟
export function validatePayment(
  contactId: string,
  amount: number,
  transactions: Transaction[]
): { ok: boolean; error?: string } {
  if (amount <= 0) {
    return { ok: false, error: "مبلغ پرداخت باید مثبت باشد." };
  }
  const balance = computeContactBalance(contactId, transactions);
  if (amount > balance.outstandingPayable) {
    return {
      ok: false,
      error: `پرداخت ${amount.toLocaleString(
        "en-US"
      )} تومان از بدهی باز ${balance.outstandingPayable.toLocaleString(
        "en-US"
      )} تومان بیشتر است. در نسخه ۱، پرداخت بیش از بدهی قابل تخصیص رد می‌شود.`,
    };
  }
  return { ok: true };
}

// اعتبارسنجی کلی قبل از ثبت تراکنش
export function validateTransaction(
  input: {
    contactId: string;
    transactionType: TransactionType;
    amount: number;
  },
  transactions: Transaction[]
): { ok: boolean; error?: string } {
  if (input.amount <= 0) {
    return { ok: false, error: "مبلغ باید مثبت باشد." };
  }
  if (input.transactionType === "RECEIPT_ALLOCATION") {
    return validateReceipt(input.contactId, input.amount, transactions);
  }
  if (input.transactionType === "PAYMENT_ALLOCATION") {
    return validatePayment(input.contactId, input.amount, transactions);
  }
  // سایر انواع همیشه مجازند (ایجاد طلب/بدهی/مانده اولیه)
  return { ok: true };
}

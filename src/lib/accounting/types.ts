// مدل داده دفتر حسابداری — نسخه ۰.۱
// این مدل بر اساس سند «مرحله صفر» طراحی شده است.
// اصول مهم:
//   - طلب و بدهی ناخالص جداگانه نگه‌داری می‌شوند؛ تهاتر خودکار ممنوع است.
//   - مبلغ به‌صورت عدد صحیح (minor unit) ذخیره می‌شود؛ از float استفاده نمی‌شود.
//   - هر تراکنش دارای واحد پول صریح است.
//   - تاریخ مؤثر (effectiveAt) از زمان ثبت (createdAt) جدا است.

export type Currency = "IRT" | "IRR"; // تومان / ریال

// انواع عملیات (بند ۴.۲ سند طراحی)
export type TransactionType =
  | "OPENING_RECEIVABLE" // مانده اولیه طلب
  | "OPENING_PAYABLE" // مانده اولیه بدهی
  | "RECEIVABLE_CHARGE" // ایجاد طلب جدید از طرف حساب
  | "PAYABLE_CHARGE" // ایجاد بدهی جدید به طرف حساب
  | "RECEIPT_ALLOCATION" // دریافت وجه تخصیص‌یافته به طلب باز
  | "PAYMENT_ALLOCATION"; // پرداخت وجه تخصیص‌یافته به بدهی باز

export type TransactionStatus = "POSTED" | "REVERSED";

export type CurrencyLabel = "تومان" | "ریال";

export interface Ledger {
  id: string;
  ownerName: string;
  name: string;
  defaultCurrency: Currency;
  createdAt: string; // ISO
}

export interface Contact {
  id: string;
  ledgerId: string;
  displayName: string;
  notes?: string;
  // اگر این مخاطب با یک کاربر واقعی (مثلاً در تلگرام) متصل باشد
  linkedTelegramId?: string | null;
  linkedProfileId?: string | null;
  createdAt: string;
  archivedAt?: string | null;
}

export interface Category {
  id: string;
  ledgerId: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  archivedAt?: string | null;
}

export interface Transaction {
  id: string;
  ledgerId: string;
  contactId: string;
  categoryId?: string | null;
  transactionType: TransactionType;
  // مبلغ به‌صورت عدد صحیح در واحد صحیح (تومان/ریال؛ اعشار نداریم).
  amount: number;
  currency: Currency;
  // تاریخ مؤثر تراکنش (ISO yyyy-mm-dd)
  effectiveAt: string;
  createdAt: string; // ISO با زمان
  createdBy: string;
  description?: string;
  status: TransactionStatus;
  reversesTransactionId?: string | null;
  // کلید idempotency برای جلوگیری از ثبت تکراری
  idempotencyKey: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string; // CREATE_TXN, REVERSE_TXN, ADD_CATEGORY, GENERATE_LINK_CODE, ...
  entityType: string;
  entityId: string;
  result: "success" | "failure";
  details?: string;
  createdAt: string;
}

export type TelegramLinkStatus = "pending" | "linked" | "revoked";

export interface TelegramLink {
  id: string;
  contactId: string; // مخاطبی که این لینک به آن تعلق دارد
  telegramUserId?: string | null;
  telegramUsername?: string | null;
  status: TelegramLinkStatus;
  scope: TelegramAccessScope;
  linkedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export type TelegramAccessScope =
  | "balance_only"
  | "transaction_list"
  | "transaction_details"
  | "category_breakdown";

export interface LinkCode {
  code: string; // کد ۶ رقمی
  contactId: string;
  scope: TelegramAccessScope;
  expiresAt: string; // ISO
  used: boolean;
  createdAt: string;
}

// برچسب فارسی انواع عملیات
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  OPENING_RECEIVABLE: "مانده اولیه طلب",
  OPENING_PAYABLE: "مانده اولیه بدهی",
  RECEIVABLE_CHARGE: "ایجاد طلب",
  PAYABLE_CHARGE: "ایجاد بدهی",
  RECEIPT_ALLOCATION: "دریافت",
  PAYMENT_ALLOCATION: "پرداخت",
};

// اثر عملیات بر طلب/بدهی
export const TRANSACTION_EFFECT: Record<
  TransactionType,
  { receivable: 1 | -1 | 0; payable: 1 | -1 | 0 }
> = {
  OPENING_RECEIVABLE: { receivable: 1, payable: 0 },
  OPENING_PAYABLE: { receivable: 0, payable: 1 },
  RECEIVABLE_CHARGE: { receivable: 1, payable: 0 },
  PAYABLE_CHARGE: { receivable: 0, payable: 1 },
  RECEIPT_ALLOCATION: { receivable: -1, payable: 0 },
  PAYMENT_ALLOCATION: { receivable: 0, payable: -1 },
};

export const CURRENCY_LABELS: Record<Currency, CurrencyLabel> = {
  IRT: "تومان",
  IRR: "ریال",
};

export const TELEGRAM_SCOPE_LABELS: Record<TelegramAccessScope, string> = {
  balance_only: "فقط مانده",
  transaction_list: "فهرست تراکنش‌ها",
  transaction_details: "جزئیات تراکنش‌ها",
  category_breakdown: "گزارش سرفصلی",
};

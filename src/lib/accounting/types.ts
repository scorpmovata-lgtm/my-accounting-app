// مدل داده دفتر حسابداری چندکاربری — نسخه ۳.۰
// ============================================================
// اصول معماری نسخه ۳:
//   ۱) دفترهای مستقل: هر کاربر بدون قیدِ ثبتِ متقابل، در دفتر خودش
//      تراکنش ثبت می‌کند (تطبیق دوطرفه حذف شد).
//   ۲) دید دوجانبه: هر کاربر در داشبورد خود می‌بیند دیگران (که به
//      طرف حسابِ او لینک‌اند) برایش چه ثبت کرده‌اند و می‌تواند روی همان
//      ردیف کامنت بنویسد (و طرف مقابل هم روی ردیف‌های او).
//   ۳) شش نوع عملیات: طلب/بدهی اولیه (موجودی آغازین)، ثبت طلب، ثبت بدهی،
//      پرداخت به، دریافت از.
//   ۴) دسته‌بندی شخصی: هر کاربر دسته‌های خودش را می‌سازد و به تراکنش
//      می‌چسباند.
//   ۵) طرف‌حساب مشترک (با پنل یا بی‌پنل) — فقط با اجازه ادمین در فرم
//      ظاهر می‌شود؛ و طرف‌حساب شخصی — فقط برای خود سازنده.
//   ۶) ادمین می‌تواند کاربران را غیرفعال کند.
//
// قرارداد مانده (مانند قبل):
//   net = totalReceivedLike − totalPaidLike
//   kinds «دریافت‌مانند» (دریافت از، ثبت بدهی، ثبت بدهی اولیه) → net ↑ (بدهکارم)
//   kinds «پرداخت‌مانند» (پرداخت به، ثبت طلب، ثبت طلب اولیه) → net ↓ (طلبکارم)
//   net > 0 → بدهی من به طرف حساب
//   net < 0 → طلب من از طرف حساب

export type Currency = "IRT" | "IRR"; // تومان / ریال

// سطح دسترسی کاربر عادی (ادمین دسترسی کامل دارد)
export type UserScope = "balance_only" | "transaction_list";

export type UserRole = "admin" | "user";

// شش نوع عملیات
export type TxnKind =
  | "opening_claim" // ثبت طلب اولیه — موجودی آغازین؛ طرف حساب به من بدهکار است
  | "opening_debt" // ثبت بدهی اولیه — موجودی آغازین؛ من به طرف حساب بدهکارم
  | "claim" // ثبت طلب — طرف حساب (همین حالا) به من بدهکار شد
  | "debt" // ثبت بدهی — من (همین حالا) به طرف حساب بدهکار شدم
  | "paid_to" // پرداخت به — پول دادم (بدهی کم/طلب زیاد می‌شود)
  | "received_from"; // دریافت از — پول گرفتم (بدهی زیاد/طلب کم می‌شود)

// ---------------------------------------------------------------------------
// موجودیت‌ها
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string;
  password: string; // موک: متن ساده. در نسخه واقعی: هش‌شده سمت سرور.
  displayName: string;
  role: UserRole;
  scope?: UserScope; // فقط برای role === "user"
  linkedCounterpartyId?: string | null;
  isActive: boolean; // ادمین می‌تواند غیرفعال کند (ورود مسدود می‌شود)
  createdAt: string;
}

export interface Counterparty {
  id: string;
  displayName: string;
  notes?: string;
  linkedUserId?: string | null;
  linkedUsername?: string | null; // برای نمایش سریع
  isShared: boolean; // مشترک (ادمین ساخته، با گرنت در دسترس) یا شخصی
  ownerUserId?: string | null; // برای شخصی: سازنده (فقط خودش می‌بیند)
  createdBy: string; // آیدی سازنده
  createdAt: string;
  archivedAt?: string | null;
}

export interface Transaction {
  id: string;
  userId: string; // صاحب این رکورد دفتر (چه کسی ثبت کرده)
  counterpartyId: string; // طرف حساب این تراکنش
  kind: TxnKind; // شش نوع عملیات (نسخه ۳ — تطابق حذف شد)
  amount: number; // عدد صحیح در واحد صحیح (تومان/ریال)
  currency: Currency;
  effectiveAt: string; // تاریخ شمسی yyyy-mm-dd
  createdAt: string; // ISO با زمان
  createdBy: string;
  description?: string;
  categoryId?: string | null; // دسته‌بندی شخصی ثبت‌کننده (اختیاری)
  status: "POSTED" | "REVERSED";
  idempotencyKey: string;
}

// دسته‌بندی شخصی هر کاربر
//   - counterpartyId === null → «عمومی»: برای همه طرف‌حساب‌ها قابل انتخاب
//   - counterpartyId پر شده → «مخصوص»: فقط برای همان طرف‌حساب قابل انتخاب
export interface Category {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  counterpartyId?: string | null;
}

// کامنت روی ردیف تراکنش — دوطرفه (ثبت‌کننده و کاربرِ موضوعِ تراکنش)
export interface TxnComment {
  id: string;
  transactionId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

// اجازه دیدن یک طرف‌حساب مشترک در فرم ثبت (فقط ادمین می‌دهد)
export interface AccessGrant {
  id: string;
  userId: string;
  counterpartyId: string;
  grantedBy: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  result: "success" | "failure";
  details?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// فرا‌داده شش نوع عملیات
// ---------------------------------------------------------------------------

export interface KindMeta {
  label: string;
  description: string;
  /** true → «دریافت‌مانند»: net ↑ (بدهکارم) */
  receivedLike: boolean;
  opening: boolean;
}

export const KIND_META: Record<TxnKind, KindMeta> = {
  opening_claim: {
    label: "ثبت طلب اولیه",
    description: "موجودی آغازین دفتر — طرف حساب از ابتدا به من بدهکار است",
    receivedLike: false,
    opening: true,
  },
  opening_debt: {
    label: "ثبت بدهی اولیه",
    description: "موجودی آغازین دفتر — من از ابتدا به طرف حساب بدهکارم",
    receivedLike: true,
    opening: true,
  },
  claim: {
    label: "ثبت طلب",
    description: "طرف حساب الان به من بدهکار شد (نسیه، وام، خدمات و…)",
    receivedLike: false,
    opening: false,
  },
  debt: {
    label: "ثبت بدهی",
    description: "من الان به طرف حساب بدهکار شدم (قرض گرفتن، خرید نسیه و…)",
    receivedLike: true,
    opening: false,
  },
  paid_to: {
    label: "پرداخت به",
    description: "پول پرداخت کردم — بدهی کم یا طلب زیاد می‌شود",
    receivedLike: false,
    opening: false,
  },
  received_from: {
    label: "دریافت از",
    description: "پول دریافت کردم — بدهی زیاد یا طلب کم می‌شود",
    receivedLike: true,
    opening: false,
  },
};

export const KIND_LABELS: Record<TxnKind, string> = {
  opening_claim: "ثبت طلب اولیه",
  opening_debt: "ثبت بدهی اولیه",
  claim: "ثبت طلب",
  debt: "ثبت بدهی",
  paid_to: "پرداخت به",
  received_from: "دریافت از",
};

export const ALL_KINDS: TxnKind[] = [
  "opening_claim",
  "opening_debt",
  "claim",
  "debt",
  "paid_to",
  "received_from",
];

export function isReceivedLike(kind: TxnKind): boolean {
  return KIND_META[kind].receivedLike;
}

export function isOpening(kind: TxnKind): boolean {
  return KIND_META[kind].opening;
}

/**
 * اثر آینه‌ای تراکنشِ دیگران روی «من»:
 * وقتی کاربر O روی طرف‌حسابِ من تراکنشی ثبت می‌کند:
 *   - اگر kind دریافت‌مانند باشد → O به من بدهکار شد → طلب من ↑ (+amount)
 *   - اگر kind پرداخت‌مانند باشد → من به O بدهکار شدم → بدهی من ↑ (+amount)
 * خروجی: تغییر «طلب من از O» (منفی یعنی بدهی من بیشتر شد)
 */
export function mirroredClaimChange(t: Transaction): number {
  return (isReceivedLike(t.kind) ? 1 : -1) * t.amount;
}

// ---------------------------------------------------------------------------
// برچسب‌های فارسی
// ---------------------------------------------------------------------------

export const SCOPE_LABELS: Record<UserScope, string> = {
  balance_only: "فقط مشاهده مانده",
  transaction_list: "مشاهده مانده و تراکنش‌ها",
};

export const SCOPE_SHORT: Record<UserScope, string> = {
  balance_only: "فقط مانده",
  transaction_list: "مانده + تراکنش‌ها",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ادمین",
  user: "کاربر",
};

export const CURRENCY_LABELS: Record<Currency, "تومان" | "ریال"> = {
  IRT: "تومان",
  IRR: "ریال",
};

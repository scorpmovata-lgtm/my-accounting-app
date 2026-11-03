// مدل داده دفتر حسابداری چندکاربری — نسخه ۲.۰
// ============================================================
// اصول معماری جدید:
//   ۱) چند کاربر: هر کاربر دفتر خودش را دارد (تراکنش‌هایی که خودش ثبت کرده).
//      کاربر A (ادمین) و کاربر B (با سطح دسترسی محدود) هرکدام وارد می‌شوند
//      و دفتر خود را می‌بینند.
//   ۲) طرف حساب‌ها متمرکز هستند: فقط ادمین ایجاد/ویرایش می‌کند و برای همه
//      کاربران یکسان‌اند. یک طرف حساب می‌تواند به یک کاربر سامانه لینک شود
//      (یعنی همان شخص است). مثلاً طرف حساب «وحید» با نام کاربری vahid@ همان
//      کاربر A است.
//   ۳) تطابق بین‌کاربری (حسابداری دوجانده): وقتی کاربر B رکورد می‌کند
//      «دریافت ۱M از وحید در ۱۴۰۵/۸/۴» و کاربر A (که همان وحید است) رکورد
//      می‌کند «پرداخت ۱M به فائزه در ۱۴۰۵/۸/۴»، سامانه این دو را کنار هم
//      قرار می‌دهد و به‌عنوان یک رویداد واقعی تأییدشده علامت‌گذاری می‌کند.
//
// قرارداد علامت‌گذاری مانده:
//   net = totalReceived − totalPaid
//   net  > 0  →  بدهی  (من به طرف حساب بدهکارم)   [نقش: بدهکار]
//   net  < 0  →  طلب   (طرف حساب به من بدهکار است) [نقش: طلب‌کار]
//   net === 0 →  تسویه
//   این قرارداد طبیعی است: «دریافت از» یعنی پول از طرف حساب به من رسیده،
//   پس من به او بدهکار می‌شوم؛ «پرداخت به» برعکس.

export type Currency = "IRT" | "IRR"; // تومان / ریال

// سطح دسترسی کاربر عادی (ادمین دسترسی کامل دارد)
export type UserScope = "balance_only" | "transaction_list";

export type UserRole = "admin" | "user";

// جهت تراکنش
export type TxDirection = "received_from" | "paid_to";

// وضعیت تطابق تراکنش با سمت دیگر:
//   - unmatched: طرف حساب به کاربری لینک نیست (شخص عادی) → تطابق انتظار نمی‌رود
//   - pending  : طرف حساب به کاربر لینک است ولی طرف مقابل هنوز ثبت نکرده
//   - matched  : طرف مقابل هم ثبت کرده → زوج تطبیق‌یافته (تأیید دوطرفه)
export type MatchStatus = "unmatched" | "pending" | "matched";

// ---------------------------------------------------------------------------
// موجودیت‌ها
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  username: string; // نام کاربری — ادمین تعیین می‌کند (مثلاً vahid)
  password: string; // موک: متن ساده. در نسخه واقعی: هش‌شده سمت سرور.
  displayName: string; // نام نمایشی فارسی (مثلاً وحید)
  role: UserRole;
  scope?: UserScope; // فقط برای role === "user"
  // طرف حسابی که نماینده این کاربر است (لینک دوطرفه با Counterparty.linkedUserId)
  linkedCounterpartyId?: string | null;
  createdAt: string;
}

export interface Counterparty {
  id: string;
  displayName: string;
  notes?: string;
  // اگر این طرف حساب با یک کاربر سامانه یکی است:
  linkedUserId?: string | null;
  linkedUsername?: string | null; // برای نمایش سریع
  createdBy: string; // آیدی ادمین که ساخته
  createdAt: string;
  archivedAt?: string | null;
}

export interface Transaction {
  id: string;
  userId: string; // صاحب این رکورد دفتر (چه کسی ثبت کرده)
  counterpartyId: string; // طرف حساب این تراکنش
  direction: TxDirection; // دریافت از / پرداخت به
  amount: number; // عدد صحیح در واحد صحیح (تومان/ریال)
  currency: Currency;
  effectiveAt: string; // تاریخ شمسی yyyy-mm-dd
  createdAt: string; // ISO با زمان
  createdBy: string;
  description?: string;
  status: "POSTED" | "REVERSED";
  // تطابق با تراکنشِ سمتِ طرف مقابل
  matchedTransactionId?: string | null;
  matchStatus: MatchStatus;
  idempotencyKey: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string; // آیدی کاربر انجام‌دهنده
  actorName: string; // نام نمایشی — برای گزارش
  action: string; // CREATE_TXN, ADD_USER, ADD_COUNTERPARTY, ...
  entityType: string;
  entityId: string;
  result: "success" | "failure";
  details?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// برچسب‌های فارسی
// ---------------------------------------------------------------------------

export const DIRECTION_LABELS: Record<TxDirection, string> = {
  received_from: "دریافت از",
  paid_to: "پرداخت به",
};

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

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  unmatched: "شخص عادی (بدون تطابق)",
  pending: "در انتظار طرف مقابل",
  matched: "تطبیق‌یافته ✓",
};

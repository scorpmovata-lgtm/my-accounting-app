// ابزار تبدیل و قالب‌بندی تاریخ هجری شمسی (جلالی)
// تبدیل در لایه نمایش/ورودی انجام می‌شود؛ در دیتابیس ISO میلادی ذخیره می‌شود.

import {
  toJalaali as jalaaliToJalaali,
  toGregorian as jalaaliToGregorian,
  isLeapJalaaliYear,
} from "jalaali-js";

export interface JalaliDate {
  jy: number; // سال شمسی
  jm: number; // ماه (۱..۱۲)
  jd: number; // روز (۱..۳۱)
}

export const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

// روزهای هفته به ترتیب فارسی: شنبه اول است
export const PERSIAN_WEEKDAYS_FULL = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

export const PERSIAN_WEEKDAYS_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

// تبدیل ارقام لاتین به فارسی
export function toPersianDigits(n: number | string): string {
  return String(n).replace(/\d/g, (d) => PERSIAN_DIGITS[parseInt(d, 10)]);
}

// تبدیل ارقام فارسی/عربی به لاتین
export function fromPersianDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) =>
      String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
    );
}

// تبدیل میلادی → شمسی
export function toJalali(date: Date | string): JalaliDate {
  const d = typeof date === "string" ? new Date(date) : date;
  const { jy, jm, jd } = jalaaliToJalaali(
    d.getFullYear(),
    d.getMonth() + 1,
    d.getDate()
  );
  return { jy, jm, jd };
}

// تبدیل شمسی → میلادی
export function fromJalali(jy: number, jm: number, jd: number): Date {
  const { gy, gm, gd } = jalaaliToGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

// تبدیل شمسی → ISO yyyy-mm-dd
export function fromJalaliToISO(jy: number, jm: number, jd: number): string {
  const d = fromJalali(jy, jm, jd);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// نمایش خوانا: "۱۵ آذر ۱۴۰۳"
export function formatJalaliLong(date: Date | string): string {
  const { jy, jm, jd } = toJalali(date);
  return `${toPersianDigits(jd)} ${PERSIAN_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

// نمایش کوتاه: "۱۴۰۳/۰۹/۱۵"
export function formatJalaliShort(date: Date | string): string {
  const { jy, jm, jd } = toJalali(date);
  const mm = String(jm).padStart(2, "0");
  const dd = String(jd).padStart(2, "0");
  return `${toPersianDigits(jy)}/${toPersianDigits(mm)}/${toPersianDigits(dd)}`;
}

// نمایش کامل با روز هفته: "جمعه، ۱۵ آذر ۱۴۰۳"
export function formatJalaliFull(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // JS getDay: Sunday=0 ... Saturday=6
  // Persian week starts with Saturday=0
  const persianWeekday = (d.getDay() + 1) % 7;
  return `${PERSIAN_WEEKDAYS_FULL[persianWeekday]}، ${formatJalaliLong(date)}`;
}

// تعداد روزهای هر ماه شمسی
export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

// روز هفته (به ترتیب فارسی شنبه=۰) برای یک تاریخ شمسی
export function getWeekdayShanbe(jy: number, jm: number, jd: number): number {
  const d = fromJalali(jy, jm, jd);
  return (d.getDay() + 1) % 7;
}

// تاریخ امروز به شمسی
export function todayJalali(): JalaliDate {
  return toJalali(new Date());
}

// امروز به ISO yyyy-mm-dd
export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// قالب‌بندی مبلغ با جداکننده هزارگان و ارقام فارسی
export function formatAmount(
  amount: number,
  currency: "IRT" | "IRR" = "IRT"
): string {
  const persianAmount = toPersianDigits(amount.toLocaleString("en-US"));
  return `${persianAmount} ${currency === "IRT" ? "تومان" : "ریال"}`;
}

// قالب‌بندی زمان به‌صورت خوانا: "۱۴۰۳/۰۹/۱۵ - ۱۴:۳۲"
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const time = `${toPersianDigits(
    String(d.getHours()).padStart(2, "0")
  )}:${toPersianDigits(String(d.getMinutes()).padStart(2, "0"))}`;
  return `${formatJalaliShort(d)} - ${time}`;
}

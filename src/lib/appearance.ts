// ============================================================
// تنظیمات نمایش سامانه «دفتر حساب کتاب»
// ============================================================
// قالب رنگی و فونت قابل انتخاب کاربر. انتخاب در localStorage همین
// دستگاه ذخیره می‌شود و پیش از رندرِ اول توسط اسکریپت درون‌خطی روی
// <html> اعمال می‌شود (data-brand / data-font) تا هیچ «فلش رنگی»
// رخ ندهد. رنگ‌های معنایی (درآمد سبز / هزینه قرمز) ثابت می‌مانند.

export type BrandId = "emerald" | "navy" | "purple" | "magenta" | "pink";

export type FontId =
  | "vazirmatn"
  | "naskh"
  | "kufi"
  | "plex"
  | "cairo"
  | "messiri"
  | "markazi";

/** کلید ذخیره در localStorage */
export const STORAGE_KEY = "dhk-appearance-v1";

export const DEFAULT_BRAND: BrandId = "emerald";
export const DEFAULT_FONT: FontId = "vazirmatn";

export interface BrandOption {
  id: BrandId;
  /** نام فارسی قالب */
  label: string;
  /** رنگ روشن گرادیان سواچ */
  from: string;
  /** رنگ تیره گرادیان سواچ */
  to: string;
  /** رنگ نوار مرورگر (meta theme-color) */
  themeColor: string;
}

export const BRAND_OPTIONS: BrandOption[] = [
  {
    id: "emerald",
    label: "زمردی",
    from: "#10b981",
    to: "#047857",
    themeColor: "#059669",
  },
  {
    id: "navy",
    label: "سرمه‌ای",
    from: "#3b82f6",
    to: "#1e3a8a",
    themeColor: "#1e40af",
  },
  {
    id: "purple",
    label: "بنفش",
    from: "#8b5cf6",
    to: "#6d28d9",
    themeColor: "#7c3aed",
  },
  {
    id: "magenta",
    label: "ارغوانی",
    from: "#c026a3",
    to: "#86198f",
    themeColor: "#a21caf",
  },
  {
    id: "pink",
    label: "صورتی ملایم",
    from: "#f472b6",
    to: "#db2777",
    themeColor: "#db2777",
  },
];

export interface FontOption {
  id: FontId;
  /** نام فارسی فونت */
  label: string;
  /** توضیح کوتاه حس بصری */
  note: string;
  /** متغیر CSS فونت برای پیش‌نمایش زنده */
  cssVar: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "vazirmatn",
    label: "وزیرمتن",
    note: "پیش‌فرض — مدرن و بسیار خوانا",
    cssVar: "var(--font-vazirmatn)",
  },
  {
    id: "naskh",
    label: "نسخ نوتو",
    note: "سنتی و کتابی",
    cssVar: "var(--font-noto-naskh)",
  },
  {
    id: "kufi",
    label: "کوفی نوتو",
    note: "هندسی و نمایشی",
    cssVar: "var(--font-noto-kufi)",
  },
  {
    id: "plex",
    label: "پلکس عربی",
    note: "رسمی و تمیز",
    cssVar: "var(--font-plex-arabic)",
  },
  {
    id: "cairo",
    label: "قاهره",
    note: "گرد و امروزی",
    cssVar: "var(--font-cairo)",
  },
  {
    id: "messiri",
    label: "المسیری",
    note: "نرم و شکیل",
    cssVar: "var(--font-el-messiri)",
  },
  {
    id: "markazi",
    label: "مرکزی",
    note: "فشرده با سریف",
    cssVar: "var(--font-markazi)",
  },
];

/**
 * اسکریپت درون‌خطی — در ابتدای <body> اجرا می‌شود و انتخاب ذخیره‌شده
 * را روی <html> اعمال می‌کند تا صفحه از همان فریم اول با قالب/فونت
 * درست رندر شود (بدون فلش رنگ پیش‌فرض).
 */
export const APPEARANCE_INIT_SCRIPT = `(function(){try{var p=JSON.parse(localStorage.getItem("${STORAGE_KEY}")||"{}");var d=document.documentElement;var b=["emerald","navy","purple","magenta","pink"];var f=["vazirmatn","naskh","kufi","plex","cairo","messiri","markazi"];if(b.indexOf(p.brand)>=0&&p.brand!=="emerald")d.setAttribute("data-brand",p.brand);if(f.indexOf(p.font)>=0&&p.font!=="vazirmatn")d.setAttribute("data-font",p.font);var m=document.querySelector('meta[name="theme-color"]');if(m){var C={emerald:"#059669",navy:"#1e40af",purple:"#7c3aed",magenta:"#a21caf",pink:"#db2777"};if(C[p.brand])m.setAttribute("content",C[p.brand]);}}catch(e){}})()`;

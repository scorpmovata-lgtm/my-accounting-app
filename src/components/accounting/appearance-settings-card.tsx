"use client";

// کارت «نمایش و شخصی‌سازی» — انتخاب قالب رنگی و فونت سامانه
// ---------------------------------------------------------------
// در «مدیریت سامانه» (ادمین) و «تنظیمات من» (همهٔ کاربران) نمایش داده
// می‌شود؛ انتخاب بی‌درنگ روی <html> اعمال و روی همین دستگاه ذخیره
// می‌شود (بدون نیاز به تغییر در سرور یا پایگاه داده).

import { useEffect, useState } from "react";
import { Check, MonitorSmartphone, Palette, Type } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/accounting/jalali";
import {
  BRAND_OPTIONS,
  DEFAULT_BRAND,
  DEFAULT_FONT,
  FONT_OPTIONS,
  STORAGE_KEY,
  type BrandId,
  type FontId,
} from "@/lib/appearance";

// ---------------------------------------------------------------------------
// هوک مدیریت نمایش — اعمال/ذخیرهٔ انتخاب کاربر
// ---------------------------------------------------------------------------

export function useAppearance() {
  // خواندن هم‌گام از localStorage در مقداردهی اولیه — این کامپوننت فقط
  // پس از ورود (سمت کلاینت) رندر می‌شود و هرگز SSR نمی‌شود؛ مقدارِ اعمال‌شده
  // توسط اسکریپت پیش از رندر همینجا خوانده می‌شود تا UI هم‌گام باشد.
  const [brand, setBrand] = useState<BrandId>(() => {
    if (typeof window === "undefined") return DEFAULT_BRAND;
    try {
      const p = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      ) as { brand?: string };
      return BRAND_OPTIONS.some((b) => b.id === p.brand)
        ? (p.brand as BrandId)
        : DEFAULT_BRAND;
    } catch {
      return DEFAULT_BRAND;
    }
  });

  const [font, setFont] = useState<FontId>(() => {
    if (typeof window === "undefined") return DEFAULT_FONT;
    try {
      const p = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      ) as { font?: string };
      return FONT_OPTIONS.some((f) => f.id === p.font)
        ? (p.font as FontId)
        : DEFAULT_FONT;
    } catch {
      return DEFAULT_FONT;
    }
  });

  // اعمال روی <html> + ذخیره + به‌روزرسانی رنگ نوار مرورگر
  useEffect(() => {
    const root = document.documentElement;
    if (brand === DEFAULT_BRAND) delete root.dataset.brand;
    else root.dataset.brand = brand;
    if (font === DEFAULT_FONT) delete root.dataset.font;
    else root.dataset.font = font;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ brand, font }));
    } catch {
      /* حالت خصوصی مرورگر — فقط در همین نشست اعمال می‌شود */
    }
    // هم‌رنگ‌کردن نوار مرورگر (PWA/موبایل) با قالب انتخابی
    const opt = BRAND_OPTIONS.find((b) => b.id === brand);
    if (opt) {
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", opt.themeColor);
    }
  }, [brand, font]);

  return { brand, setBrand, font, setFont };
}

// ---------------------------------------------------------------------------
// کارت تنظیمات نمایش
// ---------------------------------------------------------------------------

export function AppearanceSettingsCard() {
  const { brand, setBrand, font, setFont } = useAppearance();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4 text-primary" />
          نمایش و شخصی‌سازی
        </CardTitle>
        <CardDescription>
          قالب رنگی و فونت سامانه را به سلیقهٔ خود انتخاب کنید — تغییرات
          بی‌درنگ در همهٔ صفحات اعمال می‌شود و روی همین دستگاه ذخیره می‌ماند.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ─── قالب رنگی ─── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Palette className="h-3.5 w-3.5" />
            </span>
            قالب رنگی سامانه
          </div>
          <div
            className="grid grid-cols-5 gap-1.5 sm:gap-2"
            role="radiogroup"
            aria-label="انتخاب قالب رنگی"
          >
            {BRAND_OPTIONS.map((b) => {
              const active = brand === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`قالب ${b.label}`}
                  onClick={() => setBrand(b.id)}
                  className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl p-1.5 transition-transform duration-200 active:scale-95"
                >
                  <span
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-offset-2 ring-offset-background transition-all duration-200",
                      active
                        ? "ring-2 ring-primary"
                        : "group-hover:ring-2 group-hover:ring-primary/30"
                    )}
                    style={{
                      backgroundImage: `linear-gradient(to bottom left, ${b.from}, ${b.to})`,
                    }}
                  >
                    {active && (
                      <Check className="h-5 w-5 text-white drop-shadow-sm" />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-center text-[10px] leading-3",
                      active
                        ? "font-bold text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    {b.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── فونت سامانه ─── */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Type className="h-3.5 w-3.5" />
            </span>
            فونت سامانه
          </div>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="انتخاب فونت سامانه"
          >
            {FONT_OPTIONS.map((f) => {
              const active = font === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setFont(f.id)}
                  className={cn(
                    "relative min-w-0 rounded-xl border p-2.5 text-start transition-all duration-200 active:scale-[0.98]",
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  {active && (
                    <span className="absolute left-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                  {/* پیش‌نمایش زنده — هر گزینه با فونت خودش */}
                  <div
                    className="truncate text-[15px] font-bold leading-7"
                    style={{
                      fontFamily: `${f.cssVar}, var(--font-vazirmatn)`,
                    }}
                  >
                    دفتر حساب کتاب
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-1">
                    <span
                      className={cn(
                        "text-[10px]",
                        active
                          ? "font-bold text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {f.label}
                    </span>
                    <span
                      className="text-[10px] text-muted-foreground/80"
                      style={{
                        fontFamily: `${f.cssVar}, var(--font-vazirmatn)`,
                      }}
                    >
                      {toPersianDigits("123456")}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[9px] leading-3 text-muted-foreground/70">
                    {f.note}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* یادداشت */}
        <div className="flex items-start gap-1.5 rounded-lg border bg-muted/30 px-2.5 py-2 text-[10px] leading-4 text-muted-foreground">
          <MonitorSmartphone className="mt-0.5 h-3 w-3 shrink-0" />
          قالب و فونت روی همین مرورگر/دستگاه ذخیره می‌شود و برای همهٔ
          کاربرانی که از این دستگاه وارد می‌شوند یکسان است؛ رنگ سبزِ درآمد و
          قرمزِ هزینه در نمودارها معنایی است و با قالب رنگی تغییر نمی‌کند.
        </div>
      </CardContent>
    </Card>
  );
}

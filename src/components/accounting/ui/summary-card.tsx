"use client";

// SummaryCard — کارت خلاصه مالی به سبک Fintech Premium
// ---------------------------------------------------------------
// آیکون چیپ‌دار + عنوان + مقدار برجسته + چیپ ترند + اسپارک‌لاین.
// مطابق تصویر مرجع: آیکون گردگوشه، عدد درشت، خط روند پایین کارت.

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { Sparkline } from "./sparkline";

type Tone = "emerald" | "rose" | "amber" | "neutral";

const TONE_STYLES: Record<
  Tone,
  { chip: string; icon: string; value: string; spark: string }
> = {
  emerald: {
    chip: "bg-emerald-50 dark:bg-emerald-950/50",
    icon: "text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
    spark: "#059669",
  },
  rose: {
    chip: "bg-rose-50 dark:bg-rose-950/50",
    icon: "text-rose-600 dark:text-rose-400",
    value: "text-rose-700 dark:text-rose-300",
    spark: "#e11d48",
  },
  amber: {
    chip: "bg-amber-50 dark:bg-amber-950/50",
    icon: "text-amber-600 dark:text-amber-400",
    value: "text-amber-700 dark:text-amber-300",
    spark: "#d97706",
  },
  neutral: {
    chip: "bg-slate-100 dark:bg-white/8",
    icon: "text-slate-500 dark:text-slate-400",
    value: "text-slate-700 dark:text-slate-200",
    spark: "#64748b",
  },
};

interface SummaryCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  /** روند ۱۴ روزه برای اسپارک‌لاین */
  spark?: number[];
  /** درصد تغییر نسبت به بازه قبل — نمایش چیپ */
  trendPct?: number | null;
  className?: string;
}

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "emerald",
  hint,
  spark,
  trendPct = null,
  className,
}: SummaryCardProps) {
  const t = TONE_STYLES[tone];
  const abs = Math.abs(value);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border-border/80 shadow-soft transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-lift",
        className
      )}
    >
      <div className="p-4 sm:p-5">
        {/* ردیف بالا: عنوان + آیکون */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-muted-foreground">
              {label}
            </p>
            <p
              className={cn(
                "mt-1.5 text-xl font-extrabold tracking-tight sm:text-[1.55rem] sm:leading-8",
                t.value
              )}
              dir="ltr"
            >
              {toPersianDigits(abs.toLocaleString("en-US"))}
              <span className="mr-1.5 text-[11px] font-normal text-muted-foreground">
                تومان
              </span>
            </p>
          </div>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 sm:h-11 sm:w-11",
              t.chip
            )}
            aria-hidden
          >
            <Icon className={cn("h-5 w-5", t.icon)} />
          </span>
        </div>

        {/* ردیف پایین: اسپارک‌لاین + چیپ ترند */}
        <div className="mt-3 flex items-end gap-2">
          {spark && spark.length >= 2 ? (
            <Sparkline
              data={spark}
              color={t.spark}
              className="min-w-0 flex-1 opacity-90"
              height={34}
            />
          ) : (
            <div className="flex-1" />
          )}
          {trendPct !== null && Number.isFinite(trendPct) && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-0.5 rounded-full px-2 py-1 text-[11px] font-bold",
                trendPct >= 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
              )}
            >
              {trendPct > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : trendPct < 0 ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              {toPersianDigits(
                `${trendPct > 0 ? "+" : trendPct < 0 ? "−" : ""}${Math.abs(
                  Math.round(trendPct)
                )}٪`
              )}
            </span>
          )}
        </div>

        {hint && (
          <p className="mt-2 truncate text-[11px] leading-5 text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}

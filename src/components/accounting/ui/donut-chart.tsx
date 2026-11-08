"use client";

// DonutChart — نمودار دونات سبک SVG برای دسته‌بندی‌ها
// ---------------------------------------------------------------
// بدون وابستگی خارجی؛ حلقه با stroke-dasharray + فاصله بین قطاع‌ها،
// عدد کل در مرکز + راهنما (Legend) با درصد هر قطاع — مطابق تصویر مرجع.

import { toPersianDigits } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  /** متن مرکز حلقه (مثلاً جمع کل) */
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  className?: string;
}

const GAP_DEG = 4;

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 168,
  className,
}: DonutChartProps) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const R = 42; // شعاع در viewBox 100
  const C = 2 * Math.PI * R;

  // محاسبه قطاع‌ها (درصد حلقه) — با فاصله ظریف بین قطاع‌ها (روش pure)
  const fracs = slices.map((s) => (total > 0 ? s.value / total : 0));
  const startDegs = fracs.map((_, i) =>
    fracs.slice(0, i).reduce((a, b) => a + b, 0) * 360
  );
  const arcs = slices.map((s, i) => {
    const sweepDeg = fracs[i] * 360;
    const gapDeg = slices.length > 1 ? GAP_DEG : 0;
    const dash = Math.max(((sweepDeg - gapDeg) / 360) * C, 0.5);
    const offset = -((startDegs[i] + gapDeg / 2) / 360) * C;
    return { ...s, dash, offset, pct: Math.round(fracs[i] * 100) };
  });

  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:gap-5", className)}>
      {/* حلقه */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            strokeWidth="11"
            className="stroke-muted"
          />
          {arcs.map((a, i) => (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={`${a.dash} ${C - a.dash}`}
              strokeDashoffset={a.offset}
              className="transition-[stroke-dasharray] duration-700"
            />
          ))}
        </svg>
        {/* مرکز */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span
            className="text-[15px] font-extrabold tracking-tight"
            dir="ltr"
          >
            {centerValue}
          </span>
          {centerLabel && (
            <span className="text-[10px] text-muted-foreground">
              {centerLabel}
            </span>
          )}
        </div>
      </div>

      {/* راهنما */}
      <ul className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-1">
        {arcs.map((a, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: a.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-foreground/90">
              {a.label}
            </span>
            <span className="shrink-0 font-bold text-muted-foreground" dir="ltr">
              {toPersianDigits(`${a.pct}٪`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** پالت قطاع‌های دونات — هماهنگ با توکن‌های chart */
export const DONUT_PALETTE = [
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-4)",
  "var(--chart-5)",
];

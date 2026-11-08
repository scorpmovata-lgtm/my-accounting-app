"use client";

// TrendChartCard — نمودار روند تراکنش‌ها (طلب‌ساز در برابر بدهی‌ساز)
// ---------------------------------------------------------------
// بازه‌های ۷/۳۰/۹۰ روزه با فیلتر قرصی (مطابق تصویر مرجع)،
// نمودار سطحی recharts با راست‌چین‌سازی RTL و تولتیپ حرفه‌ای.

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import { isReceivedLike } from "@/lib/accounting/types";
import {
  fromJalali,
  parseShamsiString,
  PERSIAN_MONTHS,
  toJalali,
  toPersianDigits,
} from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

type RangeKey = 7 | 30 | 90;

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 7, label: "۷ روز اخیر" },
  { key: 30, label: "۳۰ روز اخیر" },
  { key: 90, label: "۹۰ روز اخیر" },
];

interface DayPoint {
  label: string;
  full: string;
  claim: number; // طلب‌ساز (پرداخت‌مانند)
  debt: number; // بدهی‌ساز (دریافت‌مانند)
}

/** خلاصه‌سازی عدد محور برای فارسی: ۲.۵م / ۲۵۰ه */
function compactAxis(n: number): string {
  if (n >= 1_000_000) {
    const v = n / 1_000_000;
    return `${toPersianDigits(v % 1 === 0 ? String(v) : v.toFixed(1))}م`;
  }
  if (n >= 1_000) {
    return `${toPersianDigits(Math.round(n / 1_000))}ه`;
  }
  return toPersianDigits(n);
}

function fmtFullAmount(n: number): string {
  return toPersianDigits(n.toLocaleString("en-US"));
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function TrendChartCard() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);
  const [range, setRange] = useState<RangeKey>(30);

  const { data, hasAny } = useMemo(() => {
    if (!currentUserId) return { data: [] as DayPoint[], hasAny: false };
    const today = startOfDay(new Date());
    const buckets: DayPoint[] = [];
    const dayMs = 86_400_000;

    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * dayMs);
      const j = toJalali(d);
      const label = `${toPersianDigits(String(j.jd))}/${toPersianDigits(
        String(j.jm).padStart(2, "0")
      )}`;
      const full = `${toPersianDigits(String(j.jd))} ${
        PERSIAN_MONTHS[j.jm - 1]
      }`;
      buckets.push({ label, full, claim: 0, debt: 0 });
    }

    let hasAny = false;
    for (const t of transactions) {
      if (t.userId !== currentUserId || t.status !== "POSTED") continue;
      const j = parseShamsiString(t.effectiveAt);
      if (!j) continue;
      const d = startOfDay(fromJalali(j.jy, j.jm, j.jd));
      const idx = range - 1 - Math.round((today.getTime() - d.getTime()) / dayMs);
      if (idx < 0 || idx >= range) continue;
      if (isReceivedLike(t.kind)) buckets[idx].debt += t.amount;
      else buckets[idx].claim += t.amount;
      hasAny = true;
    }
    return { data: buckets, hasAny };
  }, [currentUserId, transactions, range]);

  return (
    <Card className="rounded-2xl border-border/80 shadow-soft">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <BarChart3 className="h-4 w-4" />
          </span>
          روند تراکنش‌ها
        </CardTitle>
        {/* فیلتر بازه زمانی */}
        <div className="flex items-center gap-1 rounded-full bg-muted p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs",
                range === r.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={range === r.key}
            >
              {r.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pb-4 sm:px-4">
        {hasAny ? (
          <>
            {/* راهنما */}
            <div className="mb-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground sm:justify-start sm:px-2">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-1" />
                طلب‌ساز
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-chart-2" />
                بدهی‌ساز
              </span>
            </div>
            <div className="h-56 w-full sm:h-64" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="claimFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 8"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="label"
                    reversed
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    minTickGap={28}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    orientation="right"
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickFormatter={compactAxis}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as DayPoint;
                      return (
                        <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-lift" dir="rtl">
                          <p className="mb-1.5 font-semibold text-foreground">
                            {p.full}
                          </p>
                          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                            <span className="h-2 w-2 rounded-full bg-chart-1" />
                            طلب‌ساز:{" "}
                            <span className="font-bold" dir="ltr">
                              {fmtFullAmount(p.claim)}
                            </span>
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
                            <span className="h-2 w-2 rounded-full bg-chart-2" />
                            بدهی‌ساز:{" "}
                            <span className="font-bold" dir="ltr">
                              {fmtFullAmount(p.debt)}
                            </span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="claim"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#claimFill)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "#10b981",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="debt"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fill="url(#debtFill)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "#f43f5e",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center gap-2 text-center sm:h-64">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <BarChart3 className="h-5 w-5 text-muted-foreground/70" />
            </span>
            <p className="text-sm text-muted-foreground">
              در این بازه تراکنشی ثبت نشده است
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              با ثبت اولین تراکنش، روند مالی این‌جا نمایش داده می‌شود
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

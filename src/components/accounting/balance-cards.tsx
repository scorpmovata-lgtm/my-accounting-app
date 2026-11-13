"use client";

// BalanceCards — کارت‌های خلاصه مالی داشبورد (بازطراحی Premium)
// ---------------------------------------------------------------
// سه کارت خلاصه (طلب کل، بدهی کل، وضعیت خالص در کارت گرادیانی قهرمان)
// + اسپارک‌لاین روند ۱۴ روزه + چیپ درصد تغییر نسبت به هفته قبل.

import { useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  HandCoins,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { useAccountingStore } from "@/store/accounting-store";
import { computeLedgerBalance } from "@/lib/accounting/engine";
import { isReceivedLike } from "@/lib/accounting/types";
import {
  fromJalali,
  parseShamsiString,
  toPersianDigits,
} from "@/lib/accounting/jalali";
import { SummaryCard } from "./ui/summary-card";

const DAY_MS = 86_400_000;
const SPARK_DAYS = 14;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** درصد تغییر جمع ۷ روز اخیر نسبت به ۷ روز قبل از آن */
function trendPctOf(series: number[]): number | null {
  const cur = series.slice(-7).reduce((s, v) => s + v, 0);
  const prev = series.slice(-14, -7).reduce((s, v) => s + v, 0);
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function BalanceCards() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);
  const counterparties = useAccountingStore((s) => s.counterparties);

  const balance = useMemo(() => {
    if (!currentUserId) return null;
    return computeLedgerBalance(currentUserId, transactions, counterparties);
  }, [currentUserId, transactions, counterparties]);

  // روند ۱۴ روزه: جریان روزانه طلب‌ساز / بدهی‌ساز + مانده تجمعی خالص
  const { claimFlow, debtFlow, netRunning } = useMemo(() => {
    const claim = new Array<number>(SPARK_DAYS).fill(0);
    const debt = new Array<number>(SPARK_DAYS).fill(0);
    if (currentUserId) {
      const today = startOfDay(new Date());
      for (const t of transactions) {
        if (t.userId !== currentUserId || t.status !== "POSTED") continue;
        const j = parseShamsiString(t.effectiveAt);
        if (!j) continue;
        const d = startOfDay(fromJalali(j.jy, j.jm, j.jd));
        const idx = SPARK_DAYS - 1 - Math.round((today.getTime() - d.getTime()) / DAY_MS);
        if (idx < 0 || idx >= SPARK_DAYS) continue;
        if (isReceivedLike(t.kind)) debt[idx] += t.amount;
        else claim[idx] += t.amount;
      }
    }
    const running: number[] = [];
    let acc = 0;
    for (let i = 0; i < SPARK_DAYS; i++) {
      acc += claim[i] - debt[i];
      running.push(acc);
    }
    return { claimFlow: claim, debtFlow: debt, netRunning: running };
  }, [currentUserId, transactions]);

  if (!currentUserId || !balance) return null;

  const net = balance.netComputed;
  const netPositive = net > 0;
  const netZero = net === 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      {/* کارت قهرمان — وضعیت خالص (گرادیان برند انتخابی) */}
      <div className="relative overflow-hidden rounded-2xl brand-gradient-deep shadow-lift sm:col-span-2 xl:col-span-2">
        {/* تزئینات شیشه‌ای ظریف */}
        <div
          className="pointer-events-none absolute -left-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-0"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 left-14 h-36 w-36 rounded-full bg-white/8"
          aria-hidden
        />
        <Wallet
          className="pointer-events-none absolute -left-4 bottom-2 h-28 w-28 rotate-[-12deg] text-white/10"
          aria-hidden
        />

        <div className="relative p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium on-gradient-muted">
              وضعیت مالی خالص
            </p>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white">
              {netZero
                ? "تسویه کامل"
                : netPositive
                ? "در وضعیت طلب‌دار"
                : "در وضعیت بدهکار"}
            </span>
          </div>

          <p className="mt-2 text-[1.7rem] font-extrabold leading-10 tracking-tight text-white sm:text-3xl" dir="ltr">
            {netZero
              ? toPersianDigits(0)
              : `${netPositive ? "+" : "−"}${toPersianDigits(
                  Math.abs(net).toLocaleString("en-US")
                )}`}
            <span className="mr-1.5 text-xs font-normal on-gradient-muted">
              تومان
            </span>
          </p>

          <p className="mt-1 text-[11px] leading-5 on-gradient-muted">
            {netZero
              ? "همه حساب‌ها تسویه شده است"
              : netPositive
              ? "مجموع طلب شما از دیگران بیشتر از بدهی‌تان است"
              : "مجموع بدهی شما به دیگران بیشتر از طلب‌تان است"}
          </p>

          {/* اسپارک‌لاین روی گرادیان */}
          <div className="mt-3 opacity-80" aria-hidden>
            <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="h-9 w-full">
              <defs>
                <linearGradient id="hero-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const pts = netRunning;
                const max = Math.max(...pts);
                const min = Math.min(...pts);
                const span = max - min;
                const step = 100 / (pts.length - 1);
                const coords = pts.map((v, i) => {
                  const x = i * step;
                  const y = span === 0 ? 17 : 3 + (1 - (v - min) / span) * 28;
                  return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
                });
                const line = coords.join(" ");
                return (
                  <>
                    <path d={`${line} L 100 36 L 0 36 Z`} fill="url(#hero-spark)" />
                    <path
                      d={line}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  </>
                );
              })()}
            </svg>
          </div>

          {/* جمع دریافت/پرداخت */}
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/15 pt-3">
            <div className="flex items-center gap-2 text-xs">
              <ArrowDownLeft className="h-4 w-4 text-white/80" />
              <span className="on-gradient-muted">جمع دریافت‌ها:</span>
              <span className="font-bold text-white" dir="ltr">
                {toPersianDigits(balance.totalReceived.toLocaleString("en-US"))}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ArrowUpRight className="h-4 w-4 text-white/80" />
              <span className="on-gradient-muted">جمع پرداخت‌ها:</span>
              <span className="font-bold text-white" dir="ltr">
                {toPersianDigits(balance.totalPaid.toLocaleString("en-US"))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* کارت طلب کل */}
      <SummaryCard
        label="طلب کل"
        value={balance.totalReceivable}
        icon={HandCoins}
        tone="emerald"
        hint="مطالبات شما از دیگران"
        spark={claimFlow}
        trendPct={trendPctOf(claimFlow)}
      />

      {/* کارت بدهی کل */}
      <SummaryCard
        label="بدهی کل"
        value={balance.totalPayable}
        icon={TrendingDown}
        tone="rose"
        hint="بدهی شما به دیگران"
        spark={debtFlow}
        trendPct={trendPctOf(debtFlow)}
      />
    </div>
  );
}

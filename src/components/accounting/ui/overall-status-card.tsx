"use client";

// OverallStatusCard — کارت «وضعیت کلی» داشبورد
// ---------------------------------------------------------------
// یک نگاه سریع به وضعیت کلی دفتر:
//   - جمع گردش کل + تعداد تراکنش‌ها
//   - توزیع نوع عملیات (شش kind) با نمودار میله‌ای افقی رنگی
//   - دو ستون: طلب‌سازها / بدهی‌سازها
//   - نسبت طلب به بدهی (اگر قابل محاسبه باشد)
//
// این کارت مکمل CategoryBreakdown است: آن یکی تفکیک بر اساس دسته،
// این یکی تفکیک بر اساس نوع عملیات و جمع‌های کلی.

import { useMemo } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  HandCoins,
  History,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import {
  KIND_META,
  isReceivedLike,
  isOpening,
  type TxnKind,
} from "@/lib/accounting/types";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

function fmtNum(n: number): string {
  return toPersianDigits(n.toLocaleString("en-US"));
}

interface KindStat {
  kind: TxnKind;
  label: string;
  count: number;
  total: number;
  receivedLike: boolean;
  opening: boolean;
  icon: typeof Activity;
}

const KIND_ICON: Record<TxnKind, typeof Activity> = {
  opening_claim: History,
  opening_debt: History,
  claim: ArrowDownLeft,
  debt: ArrowUpRight,
  paid_to: Banknote,
  received_from: HandCoins,
};

export function OverallStatusCard() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);

  const stats = useMemo(() => {
    if (!currentUserId) return null;
    const mine = transactions.filter(
      (t) => t.userId === currentUserId && t.status === "POSTED"
    );
    const total = mine.length;
    // جمع بر اساس نوع
    const byKind = new Map<TxnKind, { count: number; total: number }>();
    for (const t of mine) {
      const r = byKind.get(t.kind) ?? { count: 0, total: 0 };
      r.count += 1;
      r.total += t.amount;
      byKind.set(t.kind, r);
    }
    // شش kind به ترتیب ثابت
    const allKinds: TxnKind[] = [
      "opening_claim",
      "opening_debt",
      "claim",
      "debt",
      "paid_to",
      "received_from",
    ];
    const rows: KindStat[] = allKinds
      .map((k) => {
        const r = byKind.get(k);
        return {
          kind: k,
          label: KIND_META[k].label,
          count: r?.count ?? 0,
          total: r?.total ?? 0,
          receivedLike: isReceivedLike(k),
          opening: isOpening(k),
          icon: KIND_ICON[k],
        };
      })
      .filter((r) => r.count > 0);
    // جمع‌های کلی
    let claimFlow = 0; // طلب‌ساز (پرداخت‌مانند)
    let debtFlow = 0; // بدهی‌ساز (دریافت‌مانند)
    for (const t of mine) {
      if (isReceivedLike(t.kind)) debtFlow += t.amount;
      else claimFlow += t.amount;
    }
    const grandTotal = claimFlow + debtFlow;
    const claimPct = grandTotal > 0 ? (claimFlow / grandTotal) * 100 : 0;
    const debtPct = grandTotal > 0 ? (debtFlow / grandTotal) * 100 : 0;
    // نسبت طلب به بدهی
    let ratio: string | null = null;
    if (claimFlow > 0 && debtFlow > 0) {
      const r = claimFlow / debtFlow;
      ratio = r >= 1 ? `${r.toFixed(2)} برابر` : `${(1 / r).toFixed(2)} برابر`;
    }
    return {
      total,
      rows,
      claimFlow,
      debtFlow,
      grandTotal,
      claimPct,
      debtPct,
      ratio,
    };
  }, [currentUserId, transactions]);

  if (!currentUserId || !stats || stats.total === 0) return null;

  const maxRowTotal = Math.max(1, ...stats.rows.map((r) => r.total));

  return (
    <Card className="rounded-2xl border-border/80 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </span>
          وضعیت کلی دفتر
          <Badge variant="secondary" className="ms-1 h-5 rounded-full px-2">
            {toPersianDigits(stats.total.toString())} تراکنش
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* جمع‌بندی دوگانه */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/15">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
              جریان طلب‌ساز
            </div>
            <div
              className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-400"
              dir="ltr"
            >
              {fmtNum(stats.claimFlow)}{" "}
              <span className="text-[10px] font-normal">تومان</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {stats.claimPct.toFixed(0)}% از کل گردش
            </div>
          </div>
          <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/15">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-rose-700 dark:text-rose-400">
              <TrendingDown className="h-3.5 w-3.5" />
              جریان بدهی‌ساز
            </div>
            <div
              className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-400"
              dir="ltr"
            >
              {fmtNum(stats.debtFlow)}{" "}
              <span className="text-[10px] font-normal">تومان</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              {stats.debtPct.toFixed(0)}% از کل گردش
            </div>
          </div>
        </div>

        {/* نوار نسبت طلب به بدهی */}
        {stats.grandTotal > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
              <span>نسبت طلب به بدهی</span>
              {stats.ratio ? (
                <span className="font-medium text-foreground" dir="ltr">
                  {stats.ratio}
                </span>
              ) : stats.claimFlow > 0 ? (
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  فقط طلب
                </span>
              ) : (
                <span className="font-medium text-rose-700 dark:text-rose-400">
                  فقط بدهی
                </span>
              )}
            </div>
            <div
              className="flex w-full overflow-hidden rounded-full bg-muted h-2"
              dir="ltr"
              aria-hidden
            >
              <div
                className="h-full bg-emerald-500/80"
                style={{ width: `${stats.claimPct}%` }}
              />
              <div
                className="h-full bg-rose-500/80"
                style={{ width: `${stats.debtPct}%` }}
              />
            </div>
          </div>
        )}

        {/* توزیع بر اساس نوع عملیات */}
        <div className="space-y-2">
          <div className="text-[11px] font-medium text-muted-foreground">
            توزیع بر اساس نوع عملیات
          </div>
          <ul className="space-y-1.5">
            {stats.rows.map((r) => {
              const Icon = r.icon;
              const widthPct = (r.total / maxRowTotal) * 100;
              return (
                <li
                  key={r.kind}
                  className="flex items-center gap-2 text-xs"
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
                      r.receivedLike
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
                      r.opening && "opacity-80"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="w-24 shrink-0 truncate text-muted-foreground">
                    {r.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "h-1.5 rounded-full",
                        r.receivedLike
                          ? "bg-rose-500/70"
                          : "bg-emerald-500/70"
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                  <span
                    className="shrink-0 font-bold text-foreground"
                    dir="ltr"
                  >
                    {fmtNum(r.total)}
                  </span>
                  <Badge
                    variant="outline"
                    className="shrink-0 h-4 px-1 text-[9px]"
                  >
                    {toPersianDigits(r.count.toString())}
                  </Badge>
                </li>
              );
            })}
          </ul>
        </div>

        {/* پانوشت */}
        <div className="border-t border-border/70 pt-3 text-[11px] text-muted-foreground leading-relaxed">
          کل گردش دفتر شما{" "}
          <span className="font-bold text-foreground" dir="ltr">
            {fmtNum(stats.grandTotal)}
          </span>{" "}
          تومان است (جمع طلب‌ساز و بدهی‌ساز). برای تحلیل ریزتر به تفکیک
          دسته‌بندی، کارت «جمع‌بندی دسته‌بندی‌ها» را ببینید.
        </div>
      </CardContent>
    </Card>
  );
}

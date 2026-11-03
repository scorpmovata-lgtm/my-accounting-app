"use client";

import { TrendingUp, TrendingDown, Scale, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import { computeLedgerBalance } from "@/lib/accounting/engine";
import { formatAmount, toPersianDigits } from "@/lib/accounting/jalali";

export function BalanceCards() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);
  const counterparties = useAccountingStore((s) => s.counterparties);

  if (!currentUserId) return null;

  const balance = computeLedgerBalance(
    currentUserId,
    transactions,
    counterparties
  );

  const cards = [
    {
      label: "طلب کل",
      value: balance.totalReceivable,
      icon: TrendingUp,
      tone: "emerald" as const,
      hint: "مطالبات شما از دیگران",
      iconBg: "bg-emerald-100 dark:bg-emerald-950/40",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "بدهی کل",
      value: balance.totalPayable,
      icon: TrendingDown,
      tone: "rose" as const,
      hint: "بدهی شما به دیگران",
      iconBg: "bg-rose-100 dark:bg-rose-950/40",
      iconColor: "text-rose-600 dark:text-rose-400",
      valueColor: "text-rose-700 dark:text-rose-300",
    },
    {
      label: "خالص",
      value: balance.netComputed,
      icon: Scale,
      tone: "neutral" as const,
      hint:
        balance.netComputed > 0
          ? "طلب خالص — بیشتر طلب‌کارید"
          : balance.netComputed < 0
          ? "بدهی خالص — بیشتر بدهکارید"
          : "تسویه کامل",
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      valueColor:
        balance.netComputed > 0
          ? "text-emerald-700 dark:text-emerald-300"
          : balance.netComputed < 0
          ? "text-rose-700 dark:text-rose-300"
          : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const sign = c.label === "خالص" ? (c.value >= 0 ? "+" : "−") : "";
        const absVal = Math.abs(c.value);
        return (
          <Card key={c.label} className="overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-muted-foreground">
                    {c.label}
                  </div>
                  <div
                    className={`mt-1 text-xl sm:text-2xl font-bold tracking-tight ${c.valueColor}`}
                    dir="ltr"
                  >
                    {sign}
                    {toPersianDigits(absVal.toLocaleString("en-US"))}
                    <span className="text-xs font-normal text-muted-foreground mr-1">
                      تومان
                    </span>
                  </div>
                </div>
                <div
                  className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${c.iconBg}`}
                >
                  <Icon className={`h-5 w-5 ${c.iconColor}`} />
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">
                {c.hint}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* جمع‌بندی دریافت/پرداخت */}
      <Card className="sm:col-span-3 border-dashed">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
            <span className="text-muted-foreground">جمع دریافت‌ها:</span>
            <span className="font-semibold" dir="ltr">
              {formatAmount(balance.totalReceived)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-rose-600" />
            <span className="text-muted-foreground">جمع پرداخت‌ها:</span>
            <span className="font-semibold" dir="ltr">
              {formatAmount(balance.totalPaid)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

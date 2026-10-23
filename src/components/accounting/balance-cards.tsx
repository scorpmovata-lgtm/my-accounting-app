"use client";

import {
  TrendingUp,
  TrendingDown,
  Scale,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LedgerBalance } from "@/lib/accounting/engine";
import { formatAmount, toPersianDigits } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

interface BalanceCardsProps {
  balance: LedgerBalance;
}

export function BalanceCards({ balance }: BalanceCardsProps) {
  const isNetPositive = balance.netComputed >= 0;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* طلب کل */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <TrendingUp className="h-5 w-5" />
              <span className="text-sm font-medium">طلب کل (ناخالص)</span>
            </div>
            <Badge
              variant="secondary"
              className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
            >
              از دیگران
            </Badge>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-emerald-700 dark:text-emerald-300 persian-nums">
            {formatAmount(balance.totalOutstandingReceivable)}
          </div>
          <div className="mt-1 text-xs text-emerald-700/70 dark:text-emerald-400/70">
            جمع دریافت‌ها تا کنون:{" "}
            {toPersianDigits(
              balance.totalReceived.toLocaleString("en-US")
            )}{" "}
            تومان
          </div>
        </CardContent>
      </Card>

      {/* بدهی کل */}
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <TrendingDown className="h-5 w-5" />
              <span className="text-sm font-medium">بدهی کل (ناخالص)</span>
            </div>
            <Badge
              variant="secondary"
              className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
            >
              به دیگران
            </Badge>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-rose-700 dark:text-rose-300 persian-nums">
            {formatAmount(balance.totalOutstandingPayable)}
          </div>
          <div className="mt-1 text-xs text-rose-700/70 dark:text-rose-400/70">
            جمع پرداخت‌ها تا کنون:{" "}
            {toPersianDigits(balance.totalPaid.toLocaleString("en-US"))} تومان
          </div>
        </CardContent>
      </Card>

      {/* خالص محاسباتی */}
      <Card
        className={cn(
          "border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20"
        )}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
              <Scale className="h-5 w-5" />
              <span className="text-sm font-medium">خالص محاسباتی</span>
            </div>
            <Badge
              variant="outline"
              className="text-amber-800 border-amber-300 dark:text-amber-400 dark:border-amber-700"
            >
              بدون تهاتر
            </Badge>
          </div>
          <div
            className={cn(
              "mt-3 text-2xl sm:text-3xl font-bold persian-nums flex items-center gap-2",
              isNetPositive
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            )}
          >
            {isNetPositive ? (
              <ArrowDownCircle className="h-6 w-6" />
            ) : (
              <ArrowUpCircle className="h-6 w-6" />
            )}
            {formatAmount(Math.abs(balance.netComputed))}
            <span className="text-sm font-normal">
              {isNetPositive ? "بستانکار" : "بدهکار"}
            </span>
          </div>
          <div className="mt-1 text-xs text-amber-800/70 dark:text-amber-400/70">
            فقط شاخص کمکی — طلب و بدهی جداگانه معتبر است
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

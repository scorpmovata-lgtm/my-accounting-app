"use client";

import { Link2, Users, ArrowLeftRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import { computeLedgerBalance } from "@/lib/accounting/engine";
import { formatAmount, toPersianDigits } from "@/lib/accounting/jalali";

export function ContactBalancesList() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const transactions = useAccountingStore((s) => s.transactions);
  const counterparties = useAccountingStore((s) => s.counterparties);

  if (!currentUserId) return null;

  const balance = computeLedgerBalance(
    currentUserId,
    transactions,
    counterparties
  );

  // مرتب‌سازی: طلب‌ها (بزرگ‌تر اول)، سپس بدهی‌ها، سپس تسویه
  const rows = balance.byContact
    .slice()
    .sort((a, b) => {
      // طلب‌ها اول (net < 0 = receivable)، بعد بدهی‌ها (net > 0)، بعد تسویه
      const aType = a.net < 0 ? 0 : a.net > 0 ? 1 : 2;
      const bType = b.net < 0 ? 0 : b.net > 0 ? 1 : 2;
      if (aType !== bType) return aType - bType;
      // داخل هر دسته، مبلغ بیشتر اول
      return Math.abs(b.net) - Math.abs(a.net);
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          مانده طرف حساب‌ها
          <Badge variant="secondary" className="mr-1 h-5">
            {toPersianDigits(rows.length.toString())} نفر
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            هنوز تراکنشی ثبت نشده است.
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {rows.map((c) => {
                const cp = counterparties.find((x) => x.id === c.counterpartyId);
                if (!cp) return null;
                const isReceivable = c.net < 0; // طلب
                const isPayable = c.net > 0; // بدهی
                return (
                  <li
                    key={c.counterpartyId}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {cp.displayName}
                        </span>
                        {cp.linkedUserId && (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            {cp.linkedUsername}
                          </Badge>
                        )}
                        {!cp.isShared && (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 px-1.5 text-[10px] border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                          >
                            <Lock className="h-2.5 w-2.5" />
                            شخصی
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-0.5">
                          <ArrowLeftRight className="h-3 w-3" />
                          {toPersianDigits(c.transactionCount.toString())} تراکنش
                        </span>
                        {cp.notes && (
                          <span className="truncate">— {cp.notes}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      {isReceivable ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            طلب باز
                          </span>
                          <span
                            className="font-bold text-emerald-700 dark:text-emerald-300"
                            dir="ltr"
                          >
                            {toPersianDigits(
                              Math.abs(c.net).toLocaleString("en-US")
                            )}
                          </span>
                        </div>
                      ) : isPayable ? (
                        <div className="flex flex-col items-end">
                          <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                            بدهی باز
                          </span>
                          <span
                            className="font-bold text-rose-700 dark:text-rose-300"
                            dir="ltr"
                          >
                            {toPersianDigits(
                              Math.abs(c.net).toLocaleString("en-US")
                            )}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="h-6">
                          تسویه
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

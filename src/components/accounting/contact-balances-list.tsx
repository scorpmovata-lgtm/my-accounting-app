"use client";

// ContactBalancesList — مانده طرف‌حساب‌ها (بازطراحی Premium)
// ---------------------------------------------------------------
// ردیف‌های مدرن: آواتار حرفی با رنگ وضعیت، نشان‌ها، مبلغ رنگی
// و نوار نسبت سهم هر طرف‌حساب از کل گردش.

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
import { toPersianDigits } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

function nameLetter(name: string): string {
  return name.trim().charAt(0) || "؟";
}

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
      const aType = a.net < 0 ? 0 : a.net > 0 ? 1 : 2;
      const bType = b.net < 0 ? 0 : b.net > 0 ? 1 : 2;
      if (aType !== bType) return aType - bType;
      return Math.abs(b.net) - Math.abs(a.net);
    });

  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.net)));

  return (
    <Card className="rounded-2xl border-border/80 shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Users className="h-4 w-4" />
          </span>
          مانده طرف‌حساب‌ها
          <Badge variant="secondary" className="ms-1 h-5 rounded-full px-2">
            {toPersianDigits(rows.length.toString())} نفر
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-5 w-5 text-muted-foreground/70" />
            </span>
            <p className="text-sm text-muted-foreground">
              هنوز تراکنشی ثبت نشده است
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y divide-border/70">
              {rows.map((c) => {
                const cp = counterparties.find((x) => x.id === c.counterpartyId);
                if (!cp) return null;
                const isReceivable = c.net < 0; // طلب
                const isPayable = c.net > 0; // بدهی
                const sharePct = (Math.abs(c.net) / maxAbs) * 100;
                return (
                  <li
                    key={c.counterpartyId}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5"
                  >
                    {/* آواتار حرفی با رنگ وضعیت */}
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-transform group-hover:scale-105",
                        isReceivable
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                          : isPayable
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                          : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400"
                      )}
                      aria-hidden
                    >
                      {nameLetter(cp.displayName)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold truncate">
                          {cp.displayName}
                        </span>
                        {cp.linkedUserId && (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 rounded-full px-1.5 text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400"
                          >
                            <Link2 className="h-2.5 w-2.5" />
                            {cp.linkedUsername}
                          </Badge>
                        )}
                        {!cp.isShared && (
                          <Badge
                            variant="outline"
                            className="h-5 gap-1 rounded-full px-1.5 text-[10px] border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-400"
                          >
                            <Lock className="h-2.5 w-2.5" />
                            شخصی
                          </Badge>
                        )}
                      </div>

                      {/* نوار نسبت + تعداد تراکنش */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="h-1.5 w-full max-w-36 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isReceivable
                                ? "bg-emerald-500/80"
                                : isPayable
                                ? "bg-rose-500/80"
                                : "bg-transparent"
                            )}
                            style={{ width: `${isReceivable || isPayable ? sharePct : 0}%` }}
                          />
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                          <ArrowLeftRight className="h-3 w-3" />
                          {toPersianDigits(c.transactionCount.toString())}
                        </span>
                      </div>
                    </div>

                    {/* مبلغ + وضعیت */}
                    <div className="shrink-0 text-left">
                      {isReceivable ? (
                        <>
                          <span
                            className="block text-sm font-bold text-emerald-700 dark:text-emerald-300"
                            dir="ltr"
                          >
                            {toPersianDigits(
                              Math.abs(c.net).toLocaleString("en-US")
                            )}
                          </span>
                          <span className="text-[10px] font-medium text-emerald-600/80 dark:text-emerald-400/80">
                            طلب باز
                          </span>
                        </>
                      ) : isPayable ? (
                        <>
                          <span
                            className="block text-sm font-bold text-rose-700 dark:text-rose-300"
                            dir="ltr"
                          >
                            {toPersianDigits(
                              Math.abs(c.net).toLocaleString("en-US")
                            )}
                          </span>
                          <span className="text-[10px] font-medium text-rose-600/80 dark:text-rose-400/80">
                            بدهی باز
                          </span>
                        </>
                      ) : (
                        <Badge variant="secondary" className="h-6 rounded-full px-2.5">
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

"use client";

import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactBalance } from "@/lib/accounting/engine";
import { Contact } from "@/lib/accounting/types";
import { formatAmount } from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

interface ContactBalancesListProps {
  contacts: Contact[];
  balances: ContactBalance[];
  onSelectContact?: (contactId: string) => void;
  selectedContactId?: string | null;
}

export function ContactBalancesList({
  contacts,
  balances,
  onSelectContact,
  selectedContactId,
}: ContactBalancesListProps) {
  // مرتب‌سازی بر اساس بزرگ‌ترین مانده (طلب + بدهی)
  const sortedBalances = [...balances].sort((a, b) => {
    const aMax = Math.max(a.outstandingReceivable, a.outstandingPayable);
    const bMax = Math.max(b.outstandingReceivable, b.outstandingPayable);
    return bMax - aMax;
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          طرف حساب‌ها
          <Badge variant="secondary" className="mr-auto">
            {toFaCount(sortedBalances.length)} نفر
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[360px] px-2">
          {sortedBalances.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              هنوز طرف حسابی ثبت نشده است.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {sortedBalances.map((b) => {
                const contact = contacts.find((c) => c.id === b.contactId);
                if (!contact) return null;
                const hasReceivable = b.outstandingReceivable > 0;
                const hasPayable = b.outstandingPayable > 0;
                const isSelected = selectedContactId === contact.id;
                return (
                  <li key={b.contactId}>
                    <button
                      type="button"
                      onClick={() => onSelectContact?.(contact.id)}
                      className={cn(
                        "w-full text-right px-3 py-3 hover:bg-accent/50 transition-colors flex flex-col gap-2",
                        isSelected && "bg-accent/70"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">
                            {contact.displayName}
                          </span>
                          {contact.linkedTelegramId && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-xs"
                            >
                              تلگرام متصل
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {toFaCount(b.transactionCount)} تراکنش
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span
                          className={cn(
                            "px-2 py-1 rounded-md",
                            hasReceivable
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          طلب: {formatAmount(b.outstandingReceivable)}
                        </span>
                        <span
                          className={cn(
                            "px-2 py-1 rounded-md",
                            hasPayable
                              ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          بدهی: {formatAmount(b.outstandingPayable)}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// کمکی: تبدیل عدد به شمارش فارسی
function toFaCount(n: number): string {
  return String(n).replace(/\d/g, (d) =>
    "۰۱۲۳۴۵۶۷۸۹"[parseInt(d, 10)]
  );
}

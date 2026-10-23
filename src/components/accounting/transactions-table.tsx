"use client";

import { useMemo, useState } from "react";
import { ArrowDownCircle, ArrowUpCircle, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import {
  TRANSACTION_TYPE_LABELS,
  TransactionType,
} from "@/lib/accounting/types";
import {
  formatAmount,
  formatJalaliFull,
  toPersianDigits,
} from "@/lib/accounting/jalali";
import { cn } from "@/lib/utils";

interface TransactionsTableProps {
  filterContactId?: string | null;
  onClearContactFilter?: () => void;
}

export function TransactionsTable({
  filterContactId,
  onClearContactFilter,
}: TransactionsTableProps) {
  const transactions = useAccountingStore((s) => s.transactions);
  const contacts = useAccountingStore((s) => s.contacts);
  const categories = useAccountingStore((s) => s.categories);

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return transactions
      .filter((t) => {
        if (filterContactId && t.contactId !== filterContactId) return false;
        if (typeFilter !== "all" && t.transactionType !== typeFilter)
          return false;
        if (search) {
          const contact = contacts.find((c) => c.id === t.contactId);
          const haystack = `${contact?.displayName ?? ""} ${
            t.description ?? ""
          }`.toLowerCase();
          if (!haystack.includes(search.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // مرتب‌سازی بر اساس تاریخ مؤثر (نزولی)
        if (a.effectiveAt !== b.effectiveAt) {
          return a.effectiveAt > b.effectiveAt ? -1 : 1;
        }
        return a.createdAt > b.createdAt ? -1 : 1;
      });
  }, [transactions, contacts, filterContactId, typeFilter, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <Filter className="h-4 w-4" />
          تراکنش‌ها
          <Badge variant="secondary" className="mr-auto">
            {toPersianDigits(filtered.length)} رکورد
          </Badge>
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {filterContactId && (
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary"
            >
              طرف حساب:{" "}
              {contacts.find((c) => c.id === filterContactId)?.displayName}
              <button
                type="button"
                className="mr-1 hover:text-destructive"
                onClick={onClearContactFilter}
                aria-label="پاک کردن فیلتر طرف حساب"
              >
                ✕
              </button>
            </Badge>
          )}
          <Input
            placeholder="جستجو در توضیحات یا نام..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-8 text-sm"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px] h-8 text-sm">
              <SelectValue placeholder="همه انواع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه انواع</SelectItem>
              {(
                Object.entries(TRANSACTION_TYPE_LABELS) as [
                  TransactionType,
                  string
                ][]
              ).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px]">
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              تراکنشی یافت نشد.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((t) => {
                const contact = contacts.find((c) => c.id === t.contactId);
                const category = t.categoryId
                  ? categories.find((c) => c.id === t.categoryId)
                  : null;
                const isReceivableSide =
                  t.transactionType === "RECEIVABLE_CHARGE" ||
                  t.transactionType === "OPENING_RECEIVABLE" ||
                  t.transactionType === "RECEIPT_ALLOCATION";
                const isIncreasing =
                  t.transactionType === "RECEIVABLE_CHARGE" ||
                  t.transactionType === "OPENING_RECEIVABLE" ||
                  t.transactionType === "PAYABLE_CHARGE" ||
                  t.transactionType === "OPENING_PAYABLE";
                return (
                  <li
                    key={t.id}
                    className="px-3 py-3 hover:bg-accent/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                          isReceivableSide
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                        )}
                      >
                        {isReceivableSide ? (
                          <ArrowDownCircle className="h-4 w-4" />
                        ) : (
                          <ArrowUpCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <div className="font-medium text-sm">
                              {contact?.displayName ?? "نامشخص"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {TRANSACTION_TYPE_LABELS[t.transactionType]}
                              {category && (
                                <>
                                  {" • "}
                                  {category.name}
                                </>
                              )}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "font-bold text-sm persian-nums whitespace-nowrap",
                              isReceivableSide
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-rose-700 dark:text-rose-300"
                            )}
                          >
                            {isIncreasing ? "+" : "−"}
                            {formatAmount(t.amount, t.currency)}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1.5 flex-wrap">
                          <div className="text-xs text-muted-foreground">
                            {formatJalaliFull(t.effectiveAt)}
                          </div>
                          {t.description && (
                            <div className="text-xs text-foreground/70 truncate max-w-[60%]">
                              {t.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
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

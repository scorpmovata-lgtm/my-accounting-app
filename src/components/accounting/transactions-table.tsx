"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Link2,
  CheckCircle2,
  Clock,
  User as UserIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  LinkIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore, selectUserTransactions } from "@/store/accounting-store";
import {
  DIRECTION_LABELS,
  type MatchStatus,
} from "@/lib/accounting/types";
import {
  formatShamsiLong,
  formatShamsiShort,
  toPersianDigits,
} from "@/lib/accounting/jalali";

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "همه" },
  { value: "matched", label: "تطبیق‌یافته" },
  { value: "pending", label: "در انتظار" },
  { value: "unmatched", label: "شخص عادی" },
];

export function TransactionsTable() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);

  const [search, setSearch] = useState("");
  const [cpFilter, setCpFilter] = useState("all");
  const [dirFilter, setDirFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const currentUser = users.find((u) => u.id === currentUserId);

  // تراکنش‌های دفتر کاربر فعلی، مرتب‌شده
  const myTxns = useMemo(() => {
    if (!currentUserId) return [];
    const state = useAccountingStore.getState();
    return selectUserTransactions(state, currentUserId);
  }, [currentUserId, transactions]);

  // فیلتر
  const filtered = useMemo(() => {
    return myTxns.filter((t) => {
      if (cpFilter !== "all" && t.counterpartyId !== cpFilter) return false;
      if (dirFilter !== "all" && t.direction !== dirFilter) return false;
      if (statusFilter !== "all" && t.matchStatus !== statusFilter) return false;
      if (search.trim()) {
        const cp = counterparties.find((c) => c.id === t.counterpartyId);
        const hay = `${cp?.displayName ?? ""} ${t.description ?? ""} ${t.effectiveAt}`;
        if (!hay.includes(search.trim())) return false;
      }
      return true;
    });
  }, [myTxns, cpFilter, dirFilter, statusFilter, search, counterparties]);

  // گروه‌بندی: زوج‌های تطبیق‌یافته را یک‌بار نمایش بده (نه دو بار)
  const rendered: React.ReactNode[] = [];
  const shownIds = new Set<string>();

  for (const t of filtered) {
    if (shownIds.has(t.id)) continue;

    if (t.matchStatus === "matched" && t.matchedTransactionId) {
      const partner = transactions.find((x) => x.id === t.matchedTransactionId);
      if (partner) {
        shownIds.add(t.id);
        shownIds.add(partner.id);
        rendered.push(
          <MatchedPairCard
            key={`pair-${t.id}`}
            mine={t}
            partner={partner}
            currentUser={currentUser}
          />
        );
        continue;
      }
    }
    shownIds.add(t.id);
    rendered.push(
      <SingleTxnCard
        key={t.id}
        txn={t}
        currentUser={currentUser}
      />
    );
  }

  if (!currentUserId || !currentUser) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          برای مشاهده تراکنش‌ها وارد شوید.
        </CardContent>
      </Card>
    );
  }

  // اگر scope فقط مانده است، کاربر نمی‌تواند تراکنش‌ها را ببیند
  if (currentUser.role === "user" && currentUser.scope === "balance_only") {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <UserIcon className="h-8 w-8 text-muted-foreground mx-auto" />
          <div className="text-sm font-medium">دسترسی محدود</div>
          <div className="text-xs text-muted-foreground">
            سطح دسترسی شما («فقط مشاهده مانده») اجازه مشاهده تراکنش‌ها را
            نمی‌دهد. فقط مانده کل طرف حساب‌ها در داشبورد قابل مشاهده است.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* فیلترها */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="جستجو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 h-9"
          />
        </div>
        <Select value={cpFilter} onValueChange={setCpFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="طرف حساب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه طرف حساب‌ها</SelectItem>
            {counterparties.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="نوع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">هر دو نوع</SelectItem>
            <SelectItem value="received_from">دریافت از</SelectItem>
            <SelectItem value="paid_to">پرداخت به</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="وضعیت تطابق" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* شمارش نتایج */}
      <div className="text-xs text-muted-foreground">
        {toPersianDigits(filtered.length.toString())} رکورد از{" "}
        {toPersianDigits(myTxns.length.toString())} تراکنش
      </div>

      {/* فهرست */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />
            تراکنشی یافت نشد.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-1">{rendered}</div>
        </ScrollArea>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// کارت زوج تطبیق‌یافته — دو رکورد کنار هم
// ---------------------------------------------------------------------------

function MatchedPairCard({
  mine,
  partner,
  currentUser,
}: {
  mine: import("@/lib/accounting/types").Transaction;
  partner: import("@/lib/accounting/types").Transaction;
  currentUser: import("@/lib/accounting/types").User | undefined;
}) {
  const counterparties = useAccountingStore((s) => s.counterparties);
  const users = useAccountingStore((s) => s.users);

  const myCp = counterparties.find((c) => c.id === mine.counterpartyId);
  const partnerCp = counterparties.find((c) => c.id === partner.counterpartyId);
  const partnerUser = users.find((u) => u.id === partner.userId);

  return (
    <Card className="overflow-hidden border-emerald-300/60 dark:border-emerald-800/60">
      {/* نوار بالایی زوج */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/20 border-b border-emerald-200/50 dark:border-emerald-900/50">
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          تطبیق‌یافته ✓
        </div>
        <div className="text-xs text-muted-foreground" dir="ltr">
          {formatShamsiShort(mine.effectiveAt)}
        </div>
      </div>
      <CardContent className="p-0">
        {/* رکورد شما */}
        <TxnRow
          txn={mine}
          cp={myCp}
          ownerLabel={`${currentUser?.displayName ?? "شما"} (شما)`}
          isMine
        />
        {/* خط ارتباطی */}
        <div className="flex items-center justify-center py-1 bg-muted/30">
          <div className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
            <LinkIcon className="h-3 w-3" />
            تطبیق داده شد
          </div>
        </div>
        {/* رکورد طرف مقابل */}
        <TxnRow
          txn={partner}
          cp={partnerCp}
          ownerLabel={`${partnerUser?.displayName ?? "طرف مقابل"} (طرف مقابل)`}
          isMine={false}
        />
        {/* توضیح مشترک */}
        {(mine.description || partner.description) && (
          <div className="px-3 py-2 border-t bg-muted/20 text-xs text-muted-foreground space-y-1">
            {mine.description && (
              <div>
                <span className="font-medium">یادداشت شما:</span> {mine.description}
              </div>
            )}
            {partner.description && (
              <div>
                <span className="font-medium">یادداشت طرف مقابل:</span>{" "}
                {partner.description}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// کارت تک‌رکوردی (pending یا unmatched)
// ---------------------------------------------------------------------------

function SingleTxnCard({
  txn,
  currentUser,
}: {
  txn: import("@/lib/accounting/types").Transaction;
  currentUser: import("@/lib/accounting/types").User | undefined;
}) {
  const counterparties = useAccountingStore((s) => s.counterparties);
  const cp = counterparties.find((c) => c.id === txn.counterpartyId);

  const isPending = txn.matchStatus === "pending";

  return (
    <Card
      className={
        isPending
          ? "overflow-hidden border-amber-300/60 dark:border-amber-800/60"
          : "overflow-hidden"
      }
    >
      {isPending ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-900/50">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" />
            در انتظار طرف مقابل
          </div>
          <div className="text-xs text-muted-foreground" dir="ltr">
            {formatShamsiShort(txn.effectiveAt)}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <UserIcon className="h-3.5 w-3.5" />
            طرف حساب شخص عادی
          </div>
          <div className="text-xs text-muted-foreground" dir="ltr">
            {formatShamsiShort(txn.effectiveAt)}
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <TxnRow
          txn={txn}
          cp={cp}
          ownerLabel={`${currentUser?.displayName ?? "شما"} (شما)`}
          isMine
        />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// یک ردیف تراکنش
// ---------------------------------------------------------------------------

function TxnRow({
  txn,
  cp,
  ownerLabel,
  isMine,
}: {
  txn: import("@/lib/accounting/types").Transaction;
  cp: import("@/lib/accounting/types").Counterparty | undefined;
  ownerLabel: string;
  isMine: boolean;
}) {
  const isReceived = txn.direction === "received_from";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
            isReceived
              ? "bg-emerald-100 dark:bg-emerald-950/40"
              : "bg-rose-100 dark:bg-rose-950/40"
          }`}
        >
          {isReceived ? (
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {DIRECTION_LABELS[txn.direction]}
            </span>
            <span className="font-medium truncate">{cp?.displayName ?? "نامشخص"}</span>
            {cp?.linkedUserId && (
              <Badge
                variant="outline"
                className="h-4 px-1 text-[9px] gap-0.5 border-emerald-300 text-emerald-700"
              >
                <Link2 className="h-2 w-2" />
                {cp.linkedUsername}
              </Badge>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {ownerLabel}
          </div>
        </div>
      </div>
      <div className="text-left shrink-0">
        <div
          className={`font-bold dir-ltr ${
            isReceived
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
          dir="ltr"
        >
          {toPersianDigits(txn.amount.toLocaleString("en-US"))}
        </div>
        <div className="text-[10px] text-muted-foreground">تومان</div>
      </div>
    </div>
  );
}

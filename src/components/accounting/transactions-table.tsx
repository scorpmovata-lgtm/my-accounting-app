"use client";

import { useMemo, useState } from "react";
import {
  Search,
  Link2,
  User as UserIcon,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  MessageCircle,
  ChevronDown,
  History,
  Lock,
  Tag,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  useAccountingStore,
  selectUserTransactions,
  selectCommentsForTxn,
} from "@/store/accounting-store";
import {
  ALL_KINDS,
  KIND_META,
  isReceivedLike,
  isOpening,
  type Transaction,
} from "@/lib/accounting/types";
import { TxnCommentsThread } from "./txn-comments-thread";
import {
  formatShamsiShort,
  toPersianDigits,
} from "@/lib/accounting/jalali";

const ALL = "all";

export function TransactionsTable() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const categories = useAccountingStore((s) => s.categories);
  const transactions = useAccountingStore((s) => s.transactions);

  const [search, setSearch] = useState("");
  const [cpFilter, setCpFilter] = useState(ALL);
  const [kindFilter, setKindFilter] = useState(ALL);
  const [catFilter, setCatFilter] = useState(ALL);

  const currentUser = users.find((u) => u.id === currentUserId);

  // تراکنش‌های دفتر کاربر فعلی، مرتب‌شده
  const myTxns = useMemo(() => {
    if (!currentUserId) return [];
    const state = useAccountingStore.getState();
    return selectUserTransactions(state, currentUserId);
  }, [currentUserId, transactions]);

  // طرف‌حساب‌هایی که خودم با آن‌ها تراکنش دارم (برای فیلتر)
  const myCpIds = useMemo(
    () => new Set(myTxns.map((t) => t.counterpartyId)),
    [myTxns]
  );
  const myCps = counterparties.filter((c) => myCpIds.has(c.id));

  const myCategories = useMemo(
    () => categories.filter((c) => c.userId === currentUserId),
    [categories, currentUserId]
  );

  // فیلتر
  const filtered = useMemo(() => {
    return myTxns.filter((t) => {
      if (cpFilter !== ALL && t.counterpartyId !== cpFilter) return false;
      if (kindFilter !== ALL && t.kind !== kindFilter) return false;
      if (catFilter !== ALL && (t.categoryId ?? "") !== catFilter) return false;
      if (search.trim()) {
        const cp = counterparties.find((c) => c.id === t.counterpartyId);
        const cat = categories.find((c) => c.id === t.categoryId);
        const hay = `${cp?.displayName ?? ""} ${t.description ?? ""} ${t.effectiveAt} ${cat?.name ?? ""}`;
        if (!hay.includes(search.trim())) return false;
      }
      return true;
    });
  }, [myTxns, cpFilter, kindFilter, catFilter, search, counterparties, categories]);

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
      {/* فیلترها — کارت شیشه‌ای */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-3 shadow-soft sm:gap-2.5 lg:grid-cols-4">
        <div className="relative col-span-2 lg:col-span-1">
          <Search className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="جستجو..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl pr-8"
          />
        </div>
        <Select value={cpFilter} onValueChange={setCpFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="طرف حساب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه طرف حساب‌ها</SelectItem>
            {myCps.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="نوع عملیات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه انواع</SelectItem>
            {ALL_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {KIND_META[k].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-10 rounded-xl">
            <SelectValue placeholder="دسته‌بندی" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>همه دسته‌ها</SelectItem>
            {myCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* شمارش نتایج */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
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
          <div className="space-y-2.5 pr-1">
            {filtered.map((t) => (
              <TxnCard key={t.id} txn={t} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// کارت تک‌رکوردی با کامنت‌های بازشدنی
// ---------------------------------------------------------------------------

function TxnCard({ txn }: { txn: Transaction }) {
  const counterparties = useAccountingStore((s) => s.counterparties);
  const categories = useAccountingStore((s) => s.categories);
  const comments = useAccountingStore((s) => s.comments);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const [open, setOpen] = useState(false);

  const cp = counterparties.find((c) => c.id === txn.counterpartyId);
  const cat = categories.find((c) => c.id === txn.categoryId);
  const receivedLike = isReceivedLike(txn.kind);
  const opening = isOpening(txn.kind);

  const commentCount = useMemo(() => {
    if (!currentUserId) return 0;
    return selectCommentsForTxn(
      useAccountingStore.getState(),
      currentUserId,
      txn.id
    ).length;
  }, [comments, currentUserId, txn.id]);

  return (
    <Card
      className={`overflow-hidden rounded-2xl border-border/80 shadow-soft transition-all duration-300 hover:shadow-lift ${
        opening
          ? "border-amber-300/60 dark:border-amber-800/60"
          : ""
      }`}
    >
      {opening && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-200/50 dark:border-amber-900/50">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <History className="h-3 w-3" />
            موجودی آغازین دفتر
          </div>
          <div className="text-[11px] text-muted-foreground" dir="ltr">
            {formatShamsiShort(txn.effectiveAt)}
          </div>
        </div>
      )}
      <CardContent className="p-0">
        {/* ردیف اصلی */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-right cursor-pointer"
          aria-expanded={open}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                receivedLike
                  ? "bg-rose-100 dark:bg-rose-950/40"
                  : "bg-emerald-100 dark:bg-emerald-950/40"
              }`}
            >
              {receivedLike ? (
                <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {KIND_META[txn.kind].label}
                </span>
                <span className="font-medium truncate">
                  {cp?.displayName ?? "نامشخص"}
                </span>
                {cp?.linkedUserId && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] gap-0.5 border-emerald-300 text-emerald-700"
                  >
                    <Link2 className="h-2 w-2" />
                    {cp.linkedUsername}
                  </Badge>
                )}
                {!cp?.isShared && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1 text-[9px] gap-0.5 border-amber-300 text-amber-700"
                  >
                    <Lock className="h-2 w-2" />
                    شخصی
                  </Badge>
                )}
                {cat && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] gap-0.5">
                    <Tag className="h-2.5 w-2.5" />
                    {cat.name}
                  </Badge>
                )}
                {commentCount > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5">
                    <MessageCircle className="h-2.5 w-2.5" />
                    {toPersianDigits(commentCount.toString())}
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {txn.description || formatShamsiShort(txn.effectiveAt)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-left">
              <div
                className={`font-bold ${
                  receivedLike
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }`}
                dir="ltr"
              >
                {toPersianDigits(txn.amount.toLocaleString("en-US"))}
              </div>
              <div className="text-[10px] text-muted-foreground text-left">تومان</div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>

        {/* بخش بازشدنی: کامنت‌ها */}
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="comments"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden border-t bg-muted/20"
            >
              <div className="p-3">
                {cp?.linkedUserId && (
                  <div className="mb-2 flex items-start gap-1.5 text-[11px] text-muted-foreground leading-relaxed">
                    <MessageCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      کاربر «{cp.linkedUsername}» این رکورد را در بخش «حساب
                      دیگران» خود می‌بیند؛ شما دو نفر می‌توانید اینجا کامنت
                      رد و بدل کنید.
                    </span>
                  </div>
                )}
                <TxnCommentsThread transactionId={txn.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

"use client";

// بخش «وضعیت تراکنش‌های من در حساب دیگران» — دید دوجانبه نسخه ۳.۰
// -------------------------------------------------------------------
// هر کاربر دفتر مستقل خودش را دارد؛ این بخش نشان می‌دهد دیگران (که به
// طرف‌حسابِ کاربر لینک‌اند) در دفترشان برای او چه ثبت کرده‌اند — گروه‌بندی
// بر اساس ثبت‌کننده، با جمع اثر آینه‌ای و امکان کامنت روی هر ردیف.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  Clock,
  Eye,
  History,
  Info,
  MessageCircle,
  Tag,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  selectCommentCount,
  useAccountingStore,
} from "@/store/accounting-store";
import { computeOthersAboutMe } from "@/lib/accounting/engine";
import {
  KIND_LABELS,
  isOpening,
  mirroredClaimChange,
  type Transaction,
} from "@/lib/accounting/types";
import { formatShamsiShort, toPersianDigits } from "@/lib/accounting/jalali";
import { TxnCommentsThread } from "./txn-comments-thread";

/** قالب عدد با جداکننده هزارگان و ارقام فارسی (بدون واحد) */
function fmtNum(n: number): string {
  return toPersianDigits(n.toLocaleString("en-US"));
}

/** حرف اول نام برای آواتار دایره‌ای */
function nameLetter(name: string): string {
  return name.trim().charAt(0) || "؟";
}

/** ساعت ثبت از رشته ISO → «۱۴:۳۲» */
function clockOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return toPersianDigits(`${hh}:${mm}`);
}

// ---------------------------------------------------------------------------
// نشان جمع اثر آینه‌ای گروه (mirroredNet)
// ---------------------------------------------------------------------------

function MirroredNetBadge({ net }: { net: number }) {
  if (net > 0) {
    return (
      <Badge
        variant="outline"
        className="h-6 gap-1 border-emerald-300/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
      >
        <ArrowDownLeft className="h-3 w-3" />
        <span className="font-semibold">طلب من:</span>
        <span dir="ltr" className="font-bold">
          {fmtNum(net)}
        </span>
        <span>تومان</span>
      </Badge>
    );
  }
  if (net < 0) {
    return (
      <Badge
        variant="outline"
        className="h-6 gap-1 border-rose-300/70 bg-rose-50/60 text-rose-700 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400"
      >
        <ArrowUpRight className="h-3 w-3" />
        <span className="font-semibold">بدهی من:</span>
        <span dir="ltr" className="font-bold">
          {fmtNum(Math.abs(net))}
        </span>
        <span>تومان</span>
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="h-6">
      تسویه
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// یک ردیف تراکنشِ «دیگران درباره من» — کلیک‌پذیر و بازشونده
// ---------------------------------------------------------------------------

function OthersTxnRow({
  t,
  ownerName,
  categoryName,
  commentCount,
  expanded,
  onToggle,
}: {
  t: Transaction;
  ownerName: string;
  categoryName: string | null;
  commentCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  // اثر آینه‌ای روی من: مثبت → طلب من ↑ ؛ منفی → بدهی من ↑
  const claim = mirroredClaimChange(t);
  const isClaimUp = claim > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-muted/40"
      >
        {/* آیکون اثر آینه‌ای */}
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            isClaimUp
              ? "bg-emerald-100 dark:bg-emerald-950/40"
              : "bg-rose-100 dark:bg-rose-950/40"
          }`}
        >
          {isClaimUp ? (
            <ArrowDownLeft className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          )}
        </span>

        {/* متن اصلی ردیف */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-xs text-muted-foreground">
              {KIND_LABELS[t.kind]}
            </span>
            <span className="text-xs text-muted-foreground">—</span>
            <span className="text-sm font-medium">{ownerName}</span>
            <span className="text-xs text-muted-foreground">
              برای من ثبت کرده
            </span>
            {isOpening(t.kind) && (
              <Badge
                variant="outline"
                className="h-5 gap-1 border-amber-300/80 bg-amber-50/60 px-1.5 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
              >
                <History className="h-2.5 w-2.5" />
                اولیه
              </Badge>
            )}
            {categoryName && (
              <Badge
                variant="outline"
                className="h-5 max-w-28 px-1.5 text-[10px] text-muted-foreground"
              >
                <Tag className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{categoryName}</span>
              </Badge>
            )}
          </div>
          {t.description ? (
            <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground">
              {t.description}
            </span>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            <span dir="ltr">{formatShamsiShort(t.effectiveAt)}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              <span dir="ltr">{clockOf(t.createdAt)}</span>
            </span>
          </div>
        </div>

        {/* ستون مبلغ + نشان کامنت */}
        <div className="flex shrink-0 flex-col items-end text-left">
          <span
            dir="ltr"
            className={`text-sm font-bold ${
              isClaimUp
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-rose-700 dark:text-rose-300"
            }`}
          >
            {fmtNum(t.amount)}
          </span>
          <span className="text-[10px] text-muted-foreground">تومان</span>
          {commentCount > 0 && (
            <span className="mt-1 flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <MessageCircle className="h-2.5 w-2.5" />
              {toPersianDigits(String(commentCount))}
            </span>
          )}
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* محتوای بازشونده: خلاصه «یعنی چه» + رشته کامنت‌ها */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-3 border-t bg-muted/30 px-4 py-3 dark:bg-muted/15">
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/25">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
                <p className="text-xs leading-5">
                  {isClaimUp ? (
                    <>
                      این رکورد یعنی {ownerName} به من{" "}
                      <span
                        dir="ltr"
                        className="font-bold text-emerald-700 dark:text-emerald-400"
                      >
                        {fmtNum(t.amount)}
                      </span>{" "}
                      تومان بدهکار شده است.
                    </>
                  ) : (
                    <>
                      این رکورد یعنی من به {ownerName}{" "}
                      <span
                        dir="ltr"
                        className="font-bold text-rose-700 dark:text-rose-400"
                      >
                        {fmtNum(t.amount)}
                      </span>{" "}
                      تومان بدهکار شده‌ام.
                    </>
                  )}
                </p>
              </div>
              <TxnCommentsThread transactionId={t.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

// ---------------------------------------------------------------------------
// بخش اصلی — بدون prop؛ همه‌چیز از استور
// ---------------------------------------------------------------------------

export function OthersLedgerSection() {
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const counterparties = useAccountingStore((s) => s.counterparties);
  const transactions = useAccountingStore((s) => s.transactions);
  const categories = useAccountingStore((s) => s.categories);
  // سابسکرایب `comments` تا شمارنده کامنت ردیف‌ها ری‌اکتیو بماند
  const comments = useAccountingStore((s) => s.comments);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const others = useMemo(() => {
    if (!currentUserId) return null;
    return computeOthersAboutMe(currentUserId, transactions, counterparties);
  }, [currentUserId, transactions, counterparties]);

  // تعداد کامنت قابل‌مشاهده برای هر ردیف (ترفند ری‌اکتیو با `comments`)
  const commentCounts = useMemo(() => {
    const map = new Map<string, number>();
    if (!currentUserId || !others) return map;
    const state = useAccountingStore.getState();
    for (const t of others.transactions) {
      map.set(t.id, selectCommentCount(state, currentUserId, t.id));
    }
    return map;
  }, [others, currentUserId, comments]);

  if (!currentUserId || !others) return null;

  const totalRecords = others.transactions.length;

  return (
    <Card className="overflow-hidden">
      {/* هدر با گرادیان بسیار ملایم سبز */}
      <CardHeader className="border-b bg-gradient-to-l from-emerald-100/80 via-emerald-50/50 to-transparent pb-3 dark:from-emerald-900/30 dark:via-emerald-950/15">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Eye className="h-4 w-4" />
          </span>
          وضعیت تراکنش‌های من در حساب دیگران
          <Badge variant="secondary" className="ms-1 h-5">
            {toPersianDigits(String(totalRecords))} رکورد
          </Badge>
        </CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">
          هر کاربر دفتر مستقل خودش را دارد؛ این‌جا می‌بینید دیگران در دفترشان
          برای شما چه ثبت کرده‌اند و می‌توانید روی همان ردیف کامنت بگذارید.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {totalRecords === 0 ? (
          // حالت خالی خلاقانه
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
              <Users className="h-7 w-7 text-muted-foreground/70" />
            </span>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              هنوز هیچ‌کس برای شما چیزی ثبت نکرده است. وقتی کاربران دیگر در
              دفترشان برایتان رکورد بزنند، این‌جا با جزئیات و امکان کامنت
              نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[28rem]">
            <div className="divide-y">
              {others.byOwner.map((owner) => {
                const ownerName =
                  users.find((u) => u.id === owner.ownerId)?.displayName ??
                  "کاربر دیگر";
                return (
                  <div key={owner.ownerId}>
                    {/* هدر گروه: ثبت‌کننده + جمع اثر آینه‌ای */}
                    <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-4 py-2.5 dark:bg-muted/20">
                      <Avatar className="size-7">
                        <AvatarFallback className="bg-emerald-100 text-[11px] font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                          {nameLetter(ownerName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm font-semibold">
                        {ownerName}
                      </span>
                      <Badge variant="secondary" className="h-5">
                        {toPersianDigits(String(owner.transactions.length))}{" "}
                        رکورد
                      </Badge>
                      <div className="ms-auto flex flex-wrap items-center gap-1.5">
                        <MirroredNetBadge net={owner.mirroredNet} />
                      </div>
                    </div>

                    {/* ردیف‌های ثبت‌شده توسط این کاربر */}
                    <ul className="divide-y bg-background">
                      {owner.transactions.map((t) => (
                        <OthersTxnRow
                          key={t.id}
                          t={t}
                          ownerName={ownerName}
                          categoryName={
                            t.categoryId
                              ? categories.find(
                                  (c) => c.id === t.categoryId
                                )?.name ?? null
                              : null
                          }
                          commentCount={commentCounts.get(t.id) ?? 0}
                          expanded={expandedId === t.id}
                          onToggle={() =>
                            setExpandedId((prev) =>
                              prev === t.id ? null : t.id
                            )
                          }
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

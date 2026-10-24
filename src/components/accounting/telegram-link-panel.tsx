"use client";

import { useMemo, useState } from "react";
import {
  Send,
  Link2,
  Clock,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { useAuthStore } from "@/store/auth-store";
import {
  TelegramAccessScope,
  TELEGRAM_SCOPE_LABELS,
  TRANSACTION_TYPE_LABELS,
} from "@/lib/accounting/types";
import {
  formatAmount,
  formatJalaliShort,
  toPersianDigits,
} from "@/lib/accounting/jalali";
import { computeContactBalance } from "@/lib/accounting/engine";
import { useToast } from "@/hooks/use-toast";

export function TelegramLinkPanel() {
  const contacts = useAccountingStore((s) => s.contacts);
  const telegramLinks = useAccountingStore((s) => s.telegramLinks);
  const linkCodes = useAccountingStore((s) => s.linkCodes);
  const transactions = useAccountingStore((s) => s.transactions);
  const generateLinkCode = useAccountingStore((s) => s.generateLinkCode);
  const revokeTelegramLink = useAccountingStore(
    (s) => s.revokeTelegramLink
  );

  const authUser = useAuthStore((s) => s.user);
  const authStatus = useAuthStore((s) => s.status);
  const { toast } = useToast();

  const [scope, setScope] = useState<TelegramAccessScope>("balance_only");
  const [busyContactId, setBusyContactId] = useState<string | null>(null);

  const linkedCount = useMemo(
    () =>
      telegramLinks.filter((l) => l.status === "linked").length,
    [telegramLinks]
  );

  async function handleGenerate(contactId: string, displayName: string) {
    setBusyContactId(contactId);
    try {
      const result = await generateLinkCode(contactId, scope);
      if (result) {
        toast({
          title: "کد اتصال تولید شد",
          description: `کد ${toPersianDigits(
            result.code
          )} برای «${displayName}» تولید شد. این کد تا ۱۰ دقیقه معتبر است.`,
        });
      } else {
        toast({
          title: "خطا",
          description:
            "تولید کد ناموفق بود. در حالت واقعی اطمینان حاصل کنید به Supabase متصل هستید.",
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({
        title: "خطا",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  async function handleRevoke(linkId: string, displayName: string) {
    setBusyContactId(linkId);
    try {
      await revokeTelegramLink(linkId);
      toast({
        title: "اتصال لغو شد",
        description: `اتصال تلگرام «${displayName}» لغو شد.`,
      });
    } catch (e) {
      toast({
        title: "خطا",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* کارت اطلاعات صاحب دفتر */}
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            صاحب دفتر (ادمین)
            <Badge variant="secondary" className="mr-auto">
              {linkedCount > 0
                ? `${toPersianDigits(linkedCount)} اتصال فعال`
                : "بدون اتصال"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-md border bg-card p-2">
              <div className="text-xs text-muted-foreground">نام</div>
              <div className="font-medium">
                {authStatus === "authenticated" && authUser
                  ? authUser.displayName ?? "نامشخص"
                  : "میهمان"}
              </div>
            </div>
            <div className="rounded-md border bg-card p-2">
              <div className="text-xs text-muted-foreground">ایمیل</div>
              <div className="font-medium truncate" dir="ltr">
                {authStatus === "authenticated" && authUser
                  ? authUser.email ?? "—"
                  : "—"}
              </div>
            </div>
            <div className="rounded-md border bg-card p-2">
              <div className="text-xs text-muted-foreground">تعداد اتصال‌ها</div>
              <div className="font-medium persian-nums">
                {toPersianDigits(linkedCount)} کاربر متصل
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            اتصال تلگرام
          </CardTitle>
          <CardDescription>
            طرف حساب‌هایی که اپ ندارند می‌توانند با ربات تلگرام مانده خود را
            ببینند. صاحب دفتر کد یک‌بارمصرف تولید می‌کند و به آن‌ها می‌دهد. کد
            ۱۰ دقیقه اعتبار دارد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm shrink-0">سطح دسترسی پیش‌فرض:</span>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as TelegramAccessScope)}
            >
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(TELEGRAM_SCOPE_LABELS) as [
                    TelegramAccessScope,
                    string
                  ][]
                ).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">
              کدهای فعال (تازه تولیدشده)
            </h4>
            <ScrollArea className="h-[160px]">
              {linkCodes.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  کد فعالی وجود ندارد. برای تولید، در فهرست پایین روی «تولید کد»
                  بزنید.
                </div>
              ) : (
                <ul className="space-y-2">
                  {linkCodes.slice(0, 6).map((lc) => {
                    const contact = contacts.find(
                      (c) => c.id === lc.contactId
                    );
                    return (
                      <li
                        key={`${lc.code}-${lc.createdAt}`}
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50"
                      >
                        <div className="min-w-0">
                          <div
                            className="font-mono text-lg font-bold tracking-widest"
                            dir="ltr"
                          >
                            {toPersianDigits(lc.code)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {contact?.displayName} •{" "}
                            {TELEGRAM_SCOPE_LABELS[lc.scope]}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                          <Clock className="h-3 w-3" />
                          انقضا: {formatJalaliShort(lc.expiresAt)}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          </div>

          <div>
            <h4 className="text-sm font-medium mb-2">
              طرف حساب‌ها و مانده‌ها
            </h4>
            <ScrollArea className="h-[420px]">
              <ul className="divide-y divide-border">
                {contacts.map((c) => {
                  const link = telegramLinks.find(
                    (l) => l.contactId === c.id && l.status === "linked"
                  );
                  // محاسبه مانده فعلی مخاطب
                  const balance = computeContactBalance(c.id, transactions);
                  // ۵ تراکنش اخیر این مخاطب
                  const recentTxns = transactions
                    .filter((t) => t.contactId === c.id)
                    .slice(0, 5);
                  const isBusy = busyContactId === c.id || busyContactId === link?.id;
                  return (
                    <li
                      key={c.id}
                      className="py-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {c.displayName}
                            </span>
                            {link ? (
                              <Badge
                                variant="outline"
                                className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs"
                              >
                                <Link2 className="h-3 w-3 ml-1" />
                                متصل
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-muted text-muted-foreground text-xs"
                              >
                                متصل نیست
                              </Badge>
                            )}
                          </div>
                          {link && (
                            <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                              {link.telegramUsername ?? link.telegramUserId}
                              {" • "}
                              {TELEGRAM_SCOPE_LABELS[link.scope]}
                            </div>
                          )}
                        </div>
                        <div className="shrink-0">
                          {link ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleRevoke(link.id, c.displayName)}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              لغو اتصال
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handleGenerate(c.id, c.displayName)}
                            >
                              {isBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              تولید کد
                            </Button>
                          )}
                        </div>
                      </div>
                      {/* مانده فعلی */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span
                          className={
                            balance.outstandingReceivable > 0
                              ? "px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "px-2 py-1 rounded-md bg-muted text-muted-foreground"
                          }
                        >
                          طلب: {formatAmount(balance.outstandingReceivable)}
                        </span>
                        <span
                          className={
                            balance.outstandingPayable > 0
                              ? "px-2 py-1 rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                              : "px-2 py-1 rounded-md bg-muted text-muted-foreground"
                          }
                        >
                          بدهی: {formatAmount(balance.outstandingPayable)}
                        </span>
                        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">
                          {toPersianDigits(balance.transactionCount)} تراکنش
                        </span>
                      </div>
                      {/* ۵ تراکنش اخیر */}
                      {recentTxns.length > 0 && (
                        <ul className="space-y-1 mt-1 pr-2 border-r-2 border-muted">
                          {recentTxns.map((t) => (
                            <li
                              key={t.id}
                              className="text-xs text-muted-foreground flex justify-between gap-2"
                            >
                              <span className="truncate">
                                {TRANSACTION_TYPE_LABELS[t.transactionType]}
                                {t.description ? ` • ${t.description}` : ""}
                              </span>
                              <span dir="ltr" className="shrink-0">
                                {formatJalaliShort(t.effectiveAt)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>

          <div className="text-xs text-muted-foreground pt-3 border-t">
            نکته امنیتی: نام کاربری تلگرام به‌تنهایی مجوز دسترسی نیست. اتصال
            باید با کد یک‌بارمصرف و با تأیید صاحب دفتر انجام شود.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

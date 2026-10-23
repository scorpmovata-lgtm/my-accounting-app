"use client";

import { useState } from "react";
import { Send, Link2, Clock, ShieldCheck, Loader2 } from "lucide-react";
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
} from "@/lib/accounting/types";
import { formatAmount, formatJalaliShort, toPersianDigits } from "@/lib/accounting/jalali";
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
  const { toast } = useToast();

  const [scope, setScope] = useState<TelegramAccessScope>("balance_only");
  const [busyContactId, setBusyContactId] = useState<string | null>(null);

  async function handleGenerate(contactId: string, displayName: string) {
    setBusyContactId(contactId);
    try {
      const result = await generateLinkCode(contactId, scope);
      if (result) {
        toast({
          title: "کد اتصال تولید شد",
          description: `کد ${toPersianDigits(
            result.code
          )} برای «${displayName}» (۱۰ دقیقه اعتبار)`,
        });
      }
    } catch (e) {
      toast({
        title: "خطا در تولید کد",
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
        title: "خطا در لغو اتصال",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setBusyContactId(null);
    }
  }

  return (
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
        {/* اطلاعات ادمین + کاربران متصل */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">صاحب دفتر (ادمین)</div>
            <div className="font-medium text-sm">
              {authUser?.displayName ?? authUser?.email ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground" dir="ltr">
              {authUser?.email}
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">کاربران متصل به تلگرام</div>
            <div className="font-medium text-sm">
              {toPersianDigits(telegramLinks.filter(l => l.status === "linked").length)} نفر
            </div>
            <div className="text-xs text-muted-foreground">
              از مجموع {toPersianDigits(contacts.length)} طرف حساب
            </div>
          </div>
        </div>

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
          <h4 className="text-sm font-medium mb-2">طرف حساب‌ها</h4>
          <ul className="divide-y divide-border">
            {contacts.map((c) => {
              const link = telegramLinks.find(
                (l) => l.contactId === c.id && l.status === "linked"
              );
              // محاسبه‌ی مانده‌ی این contact
              const contactTxns = transactions.filter(
                (t) => t.contactId === c.id && t.status === "POSTED"
              );
              let receivable = 0;
              let payable = 0;
              for (const t of contactTxns) {
                if (t.transactionType === "RECEIVABLE_CHARGE" || t.transactionType === "OPENING_RECEIVABLE") {
                  receivable += t.amount;
                } else if (t.transactionType === "PAYABLE_CHARGE" || t.transactionType === "OPENING_PAYABLE") {
                  payable += t.amount;
                } else if (t.transactionType === "RECEIPT_ALLOCATION") {
                  receivable -= t.amount;
                } else if (t.transactionType === "PAYMENT_ALLOCATION") {
                  payable -= t.amount;
                }
              }
              return (
                <li key={c.id} className="py-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0">
                      <div className="font-medium text-sm">
                        {c.displayName}
                      </div>
                      {link ? (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3 text-emerald-600" />
                          متصل با{" "}
                          {link.telegramUsername ?? link.telegramUserId}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">
                          متصل نیست
                        </div>
                      )}
                    </div>
                    {link ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyContactId === link.id}
                        onClick={() => handleRevoke(link.id, c.displayName)}
                      >
                        {busyContactId === link.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "لغو اتصال"
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyContactId === c.id}
                        onClick={() => handleGenerate(c.id, c.displayName)}
                      >
                        {busyContactId === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "تولید کد"
                        )}
                      </Button>
                    )}
                  </div>
                  {/* نمایش مانده‌ی این contact */}
                  {(receivable > 0 || payable > 0) && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300">
                        🟢 طلب: {formatAmount(receivable)}
                      </span>
                      <span className="text-rose-700 dark:text-rose-300">
                        🔴 بدهی: {formatAmount(payable)}
                      </span>
                    </div>
                  )}
                  {/* فهرست تراکنش‌های اخیر این contact (اگر متصل است) */}
                  {link && contactTxns.length > 0 && (
                    <div className="mt-2 pl-2 border-r-2 border-muted space-y-0.5">
                      <div className="text-xs text-muted-foreground pr-2">
                        تراکنش‌های اخیر ({toPersianDigits(Math.min(contactTxns.length, 5))} از {toPersianDigits(contactTxns.length)}):
                      </div>
                      {contactTxns.slice(0, 5).map((t) => (
                        <div key={t.id} className="text-xs pr-2 flex items-center justify-between">
                          <span className="text-muted-foreground">
                            {formatJalaliShort(t.effectiveAt)} • {t.transactionType}
                          </span>
                          <span className={t.transactionType === "RECEIPT_ALLOCATION" || t.transactionType === "PAYMENT_ALLOCATION" ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}>
                            {formatAmount(t.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="text-xs text-muted-foreground pt-3 border-t">
          نکته امنیتی: نام کاربری تلگرام به‌تنهایی مجوز دسترسی نیست. اتصال
          باید با کد یک‌بارمصرف و با تأیید صاحب دفتر انجام شود.
        </div>
      </CardContent>
    </Card>
  );
}

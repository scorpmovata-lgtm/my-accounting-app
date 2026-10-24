"use client";

import { useState } from "react";
import { Send, Link2, Clock, ShieldCheck } from "lucide-react";
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
import {
  TelegramAccessScope,
  TELEGRAM_SCOPE_LABELS,
} from "@/lib/accounting/types";
import { formatJalaliShort, toPersianDigits } from "@/lib/accounting/jalali";

export function TelegramLinkPanel() {
  const contacts = useAccountingStore((s) => s.contacts);
  const telegramLinks = useAccountingStore((s) => s.telegramLinks);
  const linkCodes = useAccountingStore((s) => s.linkCodes);
  const generateLinkCode = useAccountingStore((s) => s.generateLinkCode);
  const revokeTelegramLink = useAccountingStore(
    (s) => s.revokeTelegramLink
  );

  const [scope, setScope] = useState<TelegramAccessScope>("balance_only");

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
              return (
                <li
                  key={c.id}
                  className="py-2.5 flex items-center justify-between"
                >
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
                      onClick={() => revokeTelegramLink(link.id)}
                    >
                      لغو اتصال
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateLinkCode(c.id, scope)}
                    >
                      تولید کد
                    </Button>
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

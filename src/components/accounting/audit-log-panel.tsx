"use client";

import { History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { formatDateTime, toPersianDigits } from "@/lib/accounting/jalali";

const ACTION_LABELS: Record<string, string> = {
  CREATE_TXN: "ثبت تراکنش",
  REVERSE_TXN: "ابطال تراکنش",
  ADD_CATEGORY: "افزودن سرفصل",
  DEACTIVATE_CATEGORY: "غیرفعال‌سازی سرفصل",
  ADD_CONTACT: "افزودن طرف حساب",
  GENERATE_LINK_CODE: "تولید کد اتصال تلگرام",
  REVOKE_TELEGRAM_LINK: "لغو اتصال تلگرام",
};

export function AuditLogPanel() {
  const auditLogs = useAccountingStore((s) => s.auditLogs);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base flex-wrap">
          <History className="h-4 w-4" />
          گزارش ممیزی
          <Badge variant="secondary" className="mr-auto">
            {toPersianDigits(auditLogs.length)} رویداد
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[480px]">
          <ul className="divide-y divide-border">
            {auditLogs.map((log) => (
              <li key={log.id} className="px-3 py-3">
                <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        log.result === "success"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                      }
                    >
                      {log.result === "success" ? "موفق" : "ناموفق"}
                    </Badge>
                    <span className="text-sm font-medium">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </div>
                  <span
                    className="text-xs text-muted-foreground"
                    dir="ltr"
                  >
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
                {log.details && (
                  <div className="text-sm text-muted-foreground pr-1">
                    {log.details}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

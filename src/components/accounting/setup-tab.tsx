"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  Database,
  Code,
  Send,
  Rocket,
  Terminal,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  CREATE_TRANSACTION_FN,
  DEPLOYMENT_STEPS,
  SCHEMA_SQL,
  TELEGRAM_BOT_FN,
} from "@/lib/deployment-artifacts";

interface ArtifactCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  content: string;
  storageKey: string;
}

function ArtifactCard({
  icon,
  title,
  description,
  content,
  storageKey,
}: ArtifactCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text manually
    }
  }

  const lineCount = content.split("\n").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 flex-wrap">
          {icon}
          {title}
          <Badge variant="outline" className="mr-auto">
            {toFa(lineCount)} خط
          </Badge>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-4 w-4 ml-1 text-emerald-600" />
                کپی شد
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 ml-1" />
                کپی
              </>
            )}
          </Button>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-80 rounded-b-lg bg-zinc-900 text-zinc-100 dark:bg-zinc-950">
          <pre
            className="text-[11px] sm:text-xs font-mono p-3 leading-relaxed overflow-x-auto whitespace-pre text-left ltr"
            dir="ltr"
            spellCheck={false}
          >
            {content}
          </pre>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function toFa(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d, 10)]);
}

export function SetupTab() {
  return (
    <div className="space-y-4">
      {/* معرفی فاز */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Rocket className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <div className="font-medium">فاز ۲ — راه‌اندازی بک‌اند واقعی</div>
              <p className="text-muted-foreground leading-relaxed">
                در فاز ۱، پروتوتایپ با داده موک کار کرد. در فاز ۲، اپ به یک
                بک‌اند واقعی (Supabase) وصل می‌شود و ربات تلگرام راه‌اندازی
                می‌شود. سه فایل زیر آماده‌ی کپی و دیپلوی هستند. مراحل گام‌به‌گام
                را به ترتیب انجام بده.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مراحل گام‌به‌گام */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4" />
            مراحل راه‌اندازی
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y divide-border">
            {DEPLOYMENT_STEPS.map((step, i) => (
              <li key={i} className="px-4 py-3 flex gap-3">
                <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center text-sm">
                  {toFa(i + 1)}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="font-medium text-sm">{step.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {step.detail}
                  </div>
                  {step.command && (
                    <pre
                      className="mt-2 bg-zinc-900 text-zinc-100 dark:bg-zinc-950 p-2 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap text-left ltr"
                      dir="ltr"
                      spellCheck={false}
                    >
                      {step.command}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* فایل‌های قابل کپی */}
      <ArtifactCard
        icon={<Database className="h-5 w-5" />}
        title="۱. SQL Schema"
        description="در Supabase Dashboard → SQL Editor → New query → Paste → Run. همه جداول، RLS policies، triggers و indexes را می‌سازد."
        content={SCHEMA_SQL}
        storageKey="schema-sql"
      />

      <ArtifactCard
        icon={<Code className="h-5 w-5" />}
        title="۲. Edge Function: ثبت تراکنش"
        description="مسیر: supabase/functions/create-transaction/index.ts. با اعتبارسنجی اتمیک و ممیزی. کاربران مستقیماً به جدول transactions INSERT نمی‌کنند."
        content={CREATE_TRANSACTION_FN}
        storageKey="create-txn-fn"
      />

      <ArtifactCard
        icon={<Send className="h-5 w-5" />}
        title="۳. Edge Function: ربات تلگرام"
        description="مسیر: supabase/functions/telegram-bot/index.ts. دستورها: /start، /link، /balance، /transactions، /help."
        content={TELEGRAM_BOT_FN}
        storageKey="telegram-bot-fn"
      />

      {/* خلاصه امنیتی */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="p-4 sm:p-5">
          <div className="text-sm space-y-2">
            <div className="font-medium flex items-center gap-2 text-amber-800 dark:text-amber-300">
              <Check className="h-4 w-4" />
              چک‌لیست امنیتی (تأیید قبل از انتشار)
            </div>
            <ul className="text-muted-foreground space-y-1 pr-6 list-disc">
              <li>
                کلید <code className="text-foreground">service_role</code> هرگز
                در کلاینت نباشد — فقط در Edge Functions (به‌عنوان Secret).
              </li>
              <li>
                کلاینت فقط کلید <code className="text-foreground">anon</code> دارد
                که با RLS محدود است.
              </li>
              <li>
                Edge Functions را با <code className="text-foreground">--no-verify-jwt</code> دیپلوی کن تا JWT در کد بررسی شود.
              </li>
              <li>
                کلید <code className="text-foreground">TELEGRAM_BOT_TOKEN</code> را به‌عنوان Supabase Secret تنظیم کن، نه در کد.
              </li>
              <li>
                کد یک‌بارمصرف تلگرام با انقضای ۱۰ دقیقه و یک‌بارمصرف کار می‌کند.
              </li>
              <li>
                همه عملیات حساس در جدول <code className="text-foreground">audit_logs</code> ثبت می‌شوند.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Rocket,
  Database,
  FunctionSquare,
  Copy,
  Check,
  Download,
  ListOrdered,
  Server,
  Terminal,
  Send,
  GitBranch,
  Clock,
  Sparkles,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  SCHEMA_SQL_V2,
  TELEGRAM_SCHEMA_SQL,
} from "@/lib/deployment/v2-artifacts";
import {
  SCHEMA_SQL_V3,
  CREATE_TRANSACTION_FN_V3,
  ADMIN_USERS_FN_V3,
  ADMIN_COUNTERPARTIES_FN_V3,
  DEPLOYMENT_STEPS_V3,
} from "@/lib/deployment/v3-artifacts";
import { TELEGRAM_BOT_FN_V3 } from "@/lib/deployment/v3-artifacts";
import { useToast } from "@/hooks/use-toast";
import {
  APP_VERSION,
  APP_BUILD_DATE,
  APP_BUILD_TIME,
  APP_CHANGES,
  VERSION_HISTORY,
} from "@/lib/version";
import { toPersianDigits } from "@/lib/accounting/jalali";

interface ArtifactBlock {
  id: string;
  title: string;
  filename: string;
  language: string;
  code: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const ARTIFACTS: ArtifactBlock[] = [
  {
    id: "schema-v3",
    title: "۱) مهاجرت SQL نسخه ۳ (الزامی — همه نصب‌ها)",
    filename: "schema-v3.sql",
    language: "sql",
    code: SCHEMA_SQL_V3,
    icon: Database,
    description:
      "دسته‌بندی‌ها، کامنت‌ها، گرنت دسترسی طرف‌حساب‌ها، ستون is_active و kind + تبدیل داده قدیمی. idempotent و بدون حذف داده.",
  },
  {
    id: "create-txn",
    title: "۲) Edge Function: create-transaction (v3)",
    filename: "create-transaction.ts",
    language: "typescript",
    code: CREATE_TRANSACTION_FN_V3,
    icon: FunctionSquare,
    description:
      "ثبت تراکنش دفتر مستقل با شش نوع عملیات + دسته‌بندی + اعتبارسنجی دسترسی طرف‌حساب.",
  },
  {
    id: "admin-users",
    title: "۳) Edge Function: admin-users (v3)",
    filename: "admin-users.ts",
    language: "typescript",
    code: ADMIN_USERS_FN_V3,
    icon: FunctionSquare,
    description:
      "مدیریت کاربران + فعال/غیرفعال‌سازی (is_active).",
  },
  {
    id: "admin-cp",
    title: "۴) Edge Function: admin-counterparties (v3)",
    filename: "admin-counterparties.ts",
    language: "typescript",
    code: ADMIN_COUNTERPARTIES_FN_V3,
    icon: FunctionSquare,
    description:
      "مدیریت طرف‌حساب‌های مشترک + grant/revoke دسترسی کاربران (POST با action).",
  },
  {
    id: "telegram-bot",
    title: "۵) Edge Function: ربات تلگرام (v3)",
    filename: "telegram-bot.ts",
    language: "typescript",
    code: TELEGRAM_BOT_FN_V3,
    icon: Send,
    description:
      "مانده بر پایه شش نوع عملیات + نمایش دسته + رد کاربران غیرفعال. (Verify JWT خاموش بماند)",
  },
  {
    id: "schema-v2",
    title: "۶) SQL Schema نسخه ۲ (فقط نصب از صفر)",
    filename: "schema-v2.sql",
    language: "sql",
    code: SCHEMA_SQL_V2,
    icon: Database,
    description:
      "ساختار پایه PostgreSQL + RLS + is_admin/make_admin. فقط اگر پروژه‌ی خالی دارید؛ نصب موجود فقط از گام ۱ شروع می‌کند.",
  },
  {
    id: "telegram-schema",
    title: "۷) SQL تلگرام (فقط نصب از صفر)",
    filename: "telegram-schema.sql",
    language: "sql",
    code: TELEGRAM_SCHEMA_SQL,
    icon: Database,
    description:
      "جدول‌های تلگرام + telegram_enabled. برای نصب‌های موجود اجرا شده و نیازی به تکرار ندارد.",
  },
];

export function SetupTab() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback برای مرورگرهایی که Clipboard API را نمی‌دهند (مثلاً بدون HTTPS)
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

  async function handleCopy(block: ArtifactBlock) {
    const ok = await copyToClipboard(block.code);
    if (ok) {
      setCopiedId(block.id);
      toast({ title: "کپی شد", description: block.title });
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      toast({
        title: "خطا در کپی",
        description: "لطفاً از دکمه‌ی «دانلود» استفاده کنید و فایل را باز کنید.",
        variant: "destructive",
      });
    }
  }

  function handleDownload(block: ArtifactBlock) {
    const blob = new Blob([block.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = block.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "دانلود شد", description: block.filename });
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ┌ نشانهٔ نسخه — کارت اول تب راه‌اندازی ┐ */}
      <Card className="border-emerald-300/80 dark:border-emerald-800/60 overflow-hidden">
        <div className="h-1 bg-gradient-to-l from-emerald-500 via-emerald-400 to-emerald-300" />
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              <GitBranch className="h-4.5 w-4.5" />
            </span>
            <CardTitle className="text-base">نسخهٔ فعلی مصنوعات دیپلوی</CardTitle>
            <Badge className="bg-emerald-600 text-white h-6 px-2.5 text-xs font-bold" dir="ltr">
              v{toPersianDigits(APP_VERSION)}
            </Badge>
          </div>
          <CardDescription>
            اگر این نسخه را می‌بینید یعنی کد frontend شما به‌روز است؛ برای به‌روز بودن
            سمت سرور، SQL و Edge Function‌های همین صفحه را با همین نسخه مجدد Deploy کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* تاریخ و ساعت ساخت */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="h-7 gap-1.5 border-emerald-300/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              <Clock className="h-3.5 w-3.5" />
              ساخت: {APP_BUILD_DATE}
            </Badge>
            <Badge
              variant="outline"
              className="h-7 gap-1.5 border-emerald-300/80 bg-emerald-50/70 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              <Clock className="h-3.5 w-3.5" />
              ساعت: <span dir="ltr">{APP_BUILD_TIME}</span>
            </Badge>
            <Badge variant="secondary" className="h-7">
              به وقت تهران — تقویم شمسی
            </Badge>
          </div>
          {/* تغییرات این نسخه */}
          <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <Sparkles className="h-3.5 w-3.5" />
              تغییرات این نسخه:
            </div>
            <ul className="space-y-1.5">
              {APP_CHANGES.map((ch, i) => (
                <li key={i} className="flex items-start gap-2 text-xs leading-5 text-emerald-900 dark:text-emerald-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {ch}
                </li>
              ))}
            </ul>
          </div>
          {/* تاریخچهٔ نسخه‌ها */}
          <details className="group rounded-lg border bg-muted/30 dark:bg-muted/10 px-3 py-2">
            <summary className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground select-none">
              <History className="h-3.5 w-3.5" />
              تاریخچهٔ نسخه‌ها
            </summary>
            <ul className="mt-2 space-y-1.5 border-t pt-2">
              {VERSION_HISTORY.map((v) => (
                <li key={v.version} className="text-[11px] leading-5 text-muted-foreground">
                  <span className="font-mono font-bold" dir="ltr">v{v.version}</span>
                  {" — "}
                  <span>{v.date}</span>
                  {" — "}
                  <span>{v.note}</span>
                </li>
              ))}
            </ul>
          </details>
        </CardContent>
      </Card>

      {/* هشدار راه‌اندازی */}
      <Card className="border-emerald-200/70 dark:border-emerald-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Rocket className="h-5 w-5 text-primary" />
            راه‌اندازی نسخه ۳.۰ روی Supabase
          </CardTitle>
          <CardDescription>
            نصب موجود: فقط مصنوعه ۱ (مهاجرت SQL) را اجرا و چهار Edge Function را
            با نسخه v3 جایگزین کنید. نصب از صفر: ۶ و ۷ را هم قبل از ۱ اجرا
            کنید. در پایان کد frontend (دکمه دانلود پایین) را به GitHub/Vercel
            ببرید.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          {/* دانلود کد frontend */}
          <a
            href="/my-accounting-app-v2.zip?v=18"
            download
            className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Download className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                  دانلود کد frontend نسخه {toPersianDigits(APP_VERSION)}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  فایل ZIP — شامل پوشه src/ + supabase/ + پیکربندی + README
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white">my-accounting-app-v2.zip (v3)</Badge>
          </a>
          <div className="rounded-md bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/50 p-3 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <Server className="h-3.5 w-3.5" />
              نکته احراز هویت با username
            </div>
            <p className="leading-relaxed">
              Supabase Auth email/password است. ما برای پشتیبانی از username،
              از email ساختگی <code className="font-mono">username@accounting.local</code>{" "}
              استفاده می‌کنیم و username واقعی را در جدول{" "}
              <code className="font-mono">user_profiles</code> ذخیره می‌کنیم.
              کلاینت هنگام ورود:{" "}
              <code className="font-mono">
                email = username + &quot;@accounting.local&quot;
              </code>{" "}
              و سپس <code className="font-mono">signInWithPassword</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* مصنوعات کد */}
      {ARTIFACTS.map((block) => {
        const Icon = block.icon;
        const isCopied = copiedId === block.id;
        return (
          <Card key={block.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    {block.title}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {block.description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="h-6 font-mono">
                    {block.language}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(block)}
                    className="h-8"
                  >
                    {isCopied ? (
                      <Check className="h-3.5 w-3.5 ml-1 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 ml-1" />
                    )}
                    {isCopied ? "کپی شد" : "کپی"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(block)}
                    className="h-8"
                  >
                    <Download className="h-3.5 w-3.5 ml-1" />
                    دانلود
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* div ساده به‌جای ScrollArea — رندر پایدار در موبایل و انتخاب متن آسان */}
              <div className="max-h-80 overflow-auto scrollbar-persian bg-muted/40 dark:bg-muted/20 rounded-b-lg">
                <pre
                  dir="ltr"
                  className="text-left text-[11px] leading-relaxed font-mono p-4 whitespace-pre"
                >
                  <code>{block.code}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* مراحل دیپلوی */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListOrdered className="h-4 w-4 text-primary" />
            مراحل دیپلوی (گام‌به‌گام)
          </CardTitle>
          <CardDescription>
            پس از آماده‌شدن مصنوعات بالا، این چهار گام را به‌ترتیب طی کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ol className="divide-y">
            {DEPLOYMENT_STEPS_V3.map((step, i) => (
              <li key={i} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{step.title.replace(/^\d+\)\s*/, "")}</div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                      {step.body}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* راهنمای CLI */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-primary" />
            دستورات Supabase CLI (اختیاری)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-40 overflow-auto scrollbar-persian bg-muted/40 dark:bg-muted/20 rounded-md">
            <pre
              dir="ltr"
              className="text-left text-[11px] leading-relaxed font-mono p-3 whitespace-pre"
            >
{`# نصب CLI (اگر ندارید)
npm install -g supabase

# ورود به پروژه
supabase login
supabase link --project-ref <PROJECT_REF>

# ⚠️ نیازی به mkdir و ساخت فایل نیست!
# هر سه تابع از قبل در پوشه supabase/functions/ داخل zip هستند.
# فقط از ریشه پروژه دیپلوی کنید:

supabase functions deploy create-transaction
supabase functions deploy admin-users
supabase functions deploy admin-counterparties

# ✅ گام secrets حذف شد! نسخه‌های جدید CLI
# کلید service_role را خودکار داخل توابع تزریق می‌کنند.
# اگر پیام «Env name cannot start with SUPABASE_» دیدید،
# کاملاً طبیعی است — نیازی به هیچ کاری نیست.`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

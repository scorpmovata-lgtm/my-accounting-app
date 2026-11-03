"use client";

// ============================================================
// تب تلگرام (کاربر عادی) — اتصال با کد ۶ رقمی که «ادمین» می‌دهد
// کاربر کد را از ادمین می‌گیرد و در ربات می‌فرستد.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  Send,
  Link2,
  Link2Off,
  RefreshCw,
  Info,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
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
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { getClient } from "@/lib/supabase/real";

interface TgLink {
  id: string;
  telegram_user_id: number;
  telegram_username: string | null;
  status: string;
  linked_at: string;
}

export function TelegramLinkPanel() {
  const realMode = useAccountingStore((s) => s.realMode);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const { toast } = useToast();

  const [link, setLink] = useState<TgLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlinking, setUnlinking] = useState(false);

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? "";
  const botUrl = botUsername ? `https://t.me/${botUsername}` : null;

  const refresh = useCallback(async () => {
    const c = getClient();
    if (!c || !currentUserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await c
      .from("telegram_links")
      .select("id, telegram_user_id, telegram_username, status, linked_at")
      .eq("user_id", currentUserId)
      .eq("status", "linked")
      .maybeSingle();
    setLink((data as TgLink) ?? null);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    if (realMode) void refresh();
    else setLoading(false);
  }, [realMode, refresh]);

  async function handleUnlink() {
    const c = getClient();
    if (!c || !link) return;
    setUnlinking(true);
    try {
      await c.from("telegram_links").delete().eq("id", link.id);
      setLink(null);
      toast({ title: "اتصال قطع شد", description: "برای اتصال مجدد، کد جدید از ادمین بگیرید." });
    } catch (e) {
      toast({
        title: "خطا در قطع اتصال",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setUnlinking(false);
    }
  }

  // ===== حالت نمایشی (mock) =====
  if (!realMode) {
    return (
      <div className="space-y-4">
        <Card className="border-amber-200/70 dark:border-amber-900/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-primary" />
              ربات استعلام تلگرام
            </CardTitle>
            <CardDescription>
              اتصال تلگرام به حساب و مشاهده مانده از داخل ربات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <p>
                در حالت نمایشی (mock) ربات غیرفعال است. پس از دیپلوی روی
                Supabase، ادمین برای شما کد اتصال ۶ رقمی می‌سازد و با ارسال آن
                در ربات، مانده‌تان را در تلگرام می‌بینید.
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5 text-muted-foreground leading-relaxed">
              <p className="font-medium text-foreground">قابلیت‌های ربات:</p>
              <p>📊 «مانده من» — کل طلب و بدهی شما + تفکیک طرف حساب‌ها</p>
              <p>📋 «تراکنش‌ها» — فهرست تراکنش‌ها (۱۰ / ۳۰ / همه)</p>
              <p>🔒 دسترسی شما کاملاً تحت کنترل ادمین سامانه است</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== حالت واقعی =====
  return (
    <div className="space-y-4">
      {/* وضعیت اتصال */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            ربات استعلام تلگرام
          </CardTitle>
          <CardDescription>
            با اتصال تلگرام، مانده و تراکنش‌های خودتان را در ربات ببینید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال بررسی وضعیت...
            </div>
          ) : link ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                    تلگرام متصل است
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-mono" dir="ltr">
                    {link.telegram_username ?? "بدون username"}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700 shrink-0"
                onClick={handleUnlink}
                disabled={unlinking}
              >
                {unlinking ? (
                  <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                ) : (
                  <Link2Off className="h-3.5 w-3.5 ml-1" />
                )}
                قطع اتصال
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 rounded-lg border bg-muted/30 p-3">
              <XCircle className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="text-sm text-muted-foreground">
                هنوز متصل نشده‌اید — کد ۶ رقمی را از ادمین بگیرید و در ربات بفرستید
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* دریافت کد از ادمین */}
      {!link && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-primary" />
              گام ۱ — دریافت کد اتصال از ادمین
            </CardTitle>
            <CardDescription>
              ساخت کد فقط توسط ادمین سامانه انجام می‌شود
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed text-muted-foreground space-y-2">
              <p>
                از ادمین سامانه (در منوی «مدیریت» ← بخش «اتصال تلگرام کاربران»)
                درخواست <span className="font-medium text-foreground">کد اتصال ۶ رقمی</span> کنید.
              </p>
              <p>
                کد ۱۵ دقیقه اعتبار دارد و فقط یک‌بار مصرف است — به‌محض دریافت،
                آن را در ربات بفرستید.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ارسال به ربات */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-primary" />
            گام ۲ — ارسال کد در ربات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="text-sm space-y-2 text-muted-foreground leading-relaxed list-decimal list-inside">
            <li>
              ربات را در تلگرام باز کنید
              {botUrl ? (
                <a
                  href={botUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline mx-1"
                >
                  @{botUsername}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="mx-1">(آدرس ربات را ادمین اعلام می‌کند)</span>
              )}
              و دکمه Start را بزنید
            </li>
            <li>
              کد ۶ رقمی را بفرستید یا دستور{" "}
              <code dir="ltr" className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
                /link کد
              </code>{" "}
              را بزنید
            </li>
            <li>پیام «✅ اتصال موفق» را دریافت کنید و دکمه «📊 مانده من» را بزنید</li>
          </ol>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="h-3.5 w-3.5 ml-1" />
              بررسی وضعیت اتصال
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* راهنمای دستورهای ربات */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">دستورهای ربات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-xs">
            {[
              { cmd: "📊 مانده من", desc: "کل طلب و بدهی + تفکیک طرف حساب‌ها" },
              { cmd: "📋 تراکنش‌ها", desc: "فهرست تراکنش‌ها (۱۰ / ۳۰ / همه)" },
              { cmd: "🔗 اتصال با کد", desc: "راهنمای اتصال" },
              { cmd: "/help", desc: "راهنمای کامل" },
            ].map((r) => (
              <div
                key={r.cmd}
                className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
              >
                <span className="font-medium">{r.cmd}</span>
                <span className="text-muted-foreground text-left">{r.desc}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
            <Badge variant="outline" className="shrink-0">
              دسترسی
            </Badge>
            <p>
              ربات دقیقاً همان سطح دسترسی شما در اپ را رعایت می‌کند: اگر
              «فقط مانده» باشید، تراکنش‌ها نمایش داده نمی‌شوند. ادمین نیز
              می‌تواند دسترسی تلگرام شما را قطع کند.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

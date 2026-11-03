"use client";

// ============================================================
// بخش مدیریت اتصال تلگرام کاربران — فقط ادمین
// ادمین برای هر کاربر کد اتصال ۶ رقمی می‌سازد و به او می‌دهد
// (یا نمی‌دهد). کاربر کد را در ربات تلگرام می‌فرستد و وصل می‌شود.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import {
  Send,
  KeyRound,
  Link2,
  Link2Off,
  Loader2,
  Copy,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { getClient } from "@/lib/supabase/real";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { SCOPE_SHORT } from "@/lib/accounting/types";

// ---------- مدل‌های داخلی ----------

interface TgLinkRow {
  user_id: string;
  telegram_username: string | null;
  linked_at: string;
}

interface MockTgState {
  enabled: boolean;
  link: TgLinkRow | null;
}

// وضعیت نمایشی (mock) — سطح ماژول تا با تعویض تب پاک نشود
const mockTgState = new Map<string, MockTgState>();

function mockStateFor(userId: string): MockTgState {
  let st = mockTgState.get(userId);
  if (!st) {
    st = { enabled: true, link: null };
    mockTgState.set(userId, st);
  }
  return st;
}

function randomCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ---------- بخش اصلی ----------

export function AdminTelegramSection() {
  const users = useAccountingStore((s) => s.users);
  const realMode = useAccountingStore((s) => s.realMode);
  const { toast } = useToast();

  const [links, setLinks] = useState<Record<string, TgLinkRow>>({});
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [unlinkingFor, setUnlinkingFor] = useState<string | null>(null);
  const [codeDialog, setCodeDialog] = useState<{
    userName: string;
    code: string;
    expiresAt: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // ----- بارگذاری وضعیت (حالت واقعی) -----
  const refresh = useCallback(async () => {
    const c = getClient();
    if (!realMode || !c) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [linksRes, profilesRes] = await Promise.all([
        c.from("telegram_links").select("user_id, telegram_username, status, linked_at").eq("status", "linked"),
        c.from("user_profiles").select("id, telegram_enabled"),
      ]);
      const lm: Record<string, TgLinkRow> = {};
      for (const r of (linksRes.data ?? []) as Array<TgLinkRow & { status: string }>) {
        lm[r.user_id] = { user_id: r.user_id, telegram_username: r.telegram_username, linked_at: r.linked_at };
      }
      setLinks(lm);
      const em: Record<string, boolean> = {};
      for (const p of (profilesRes.data ?? []) as Array<{ id: string; telegram_enabled: boolean | null }>) {
        em[p.id] = p.telegram_enabled !== false;
      }
      setEnabledMap(em);
    } catch {
      // در صورت خطا، حالت خالی نمایش داده می‌شود
    } finally {
      setLoading(false);
    }
  }, [realMode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function getState(userId: string): { enabled: boolean; link: TgLinkRow | null } {
    if (realMode) {
      return { enabled: enabledMap[userId] !== false, link: links[userId] ?? null };
    }
    const st = mockStateFor(userId);
    return { enabled: st.enabled, link: st.link };
  }

  // ----- ساخت کد اتصال برای کاربر -----
  async function handleGenerate(userId: string, userName: string) {
    setGeneratingFor(userId);
    setCopied(false);
    try {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      let code: string | null = null;

      if (realMode) {
        const c = getClient();
        if (!c) throw new Error("کلاینت Supabase در دسترس نیست");
        // در صورت تصادم کد (بسیار بعید) تا ۳ بار تلاش می‌کنیم
        for (let i = 0; i < 3 && !code; i++) {
          const { data, error } = await c
            .from("telegram_link_codes")
            .insert({ code: randomCode(), user_id: userId, expires_at: expiresAt })
            .select("code")
            .single();
          if (error) {
            if (error.code === "23505") continue; // کد تکراری — دوباره بساز
            throw error;
          }
          code = data.code;
        }
        if (!code) throw new Error("ساخت کد ناموفق بود");
      } else {
        code = randomCode();
      }

      setCodeDialog({ userName, code, expiresAt });
    } catch (e) {
      toast({
        title: "خطا در ساخت کد",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setGeneratingFor(null);
    }
  }

  // ----- قطع اتصال کاربر -----
  async function handleUnlink(userId: string) {
    setUnlinkingFor(userId);
    try {
      if (realMode) {
        const c = getClient();
        if (!c) throw new Error("کلاینت Supabase در دسترس نیست");
        await c.from("telegram_links").delete().eq("user_id", userId);
        await refresh();
      } else {
        const st = mockStateFor(userId);
        st.link = null;
        setLinks((prev) => {
          const next = { ...prev };
          delete next[userId];
          return next;
        });
      }
      toast({ title: "اتصال قطع شد", description: "کاربر برای اتصال مجدد به کد جدید نیاز دارد." });
    } catch (e) {
      toast({
        title: "خطا در قطع اتصال",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    } finally {
      setUnlinkingFor(null);
    }
  }

  // ----- فعال/غیرفعال کردن دسترسی تلگرام کاربر -----
  async function handleToggleEnabled(userId: string, next: boolean) {
    // بهینه‌سازی ساده (optimistic)
    if (realMode) {
      setEnabledMap((prev) => ({ ...prev, [userId]: next }));
    } else {
      mockStateFor(userId).enabled = next;
      setEnabledMap((prev) => ({ ...prev, [userId]: next }));
    }
    try {
      if (realMode) {
        const c = getClient();
        if (!c) throw new Error("کلاینت Supabase در دسترس نیست");
        const { error } = await c
          .from("user_profiles")
          .update({ telegram_enabled: next })
          .eq("id", userId);
        if (error) throw error;
      }
      toast({
        title: next ? "دسترسی تلگرام فعال شد" : "دسترسی تلگرام غیرفعال شد",
        description: next
          ? "کاربر می‌تواند با کد اتصال وصل شود."
          : "اگر کاربر متصل باشد، ربات دیگر به او پاسخ نمی‌دهد.",
      });
    } catch (e) {
      // بازگشت به حالت قبل در صورت خطا
      if (realMode) setEnabledMap((prev) => ({ ...prev, [userId]: !next }));
      toast({
        title: "خطا در تغییر دسترسی",
        description: e instanceof Error ? e.message : "دوباره تلاش کنید",
        variant: "destructive",
      });
    }
  }

  async function handleCopy(code: string) {
    const ok = await copyText(code);
    if (ok) {
      setCopied(true);
      toast({ title: "کد کپی شد", description: "کد را برای کاربر بفرستید." });
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast({
        title: "کپی خودکار ممکن نشد",
        description: "کد را دستی انتخاب و کپی کنید.",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4 text-primary" />
          اتصال تلگرام کاربران
          <Badge variant="secondary" className="mr-1 h-5 text-[10px]">
            ربات استعلام
          </Badge>
        </CardTitle>
        <CardDescription>
          برای هر کاربر کد اتصال ۶ رقمی بسازید و به او بدهید. کاربر کد را در
          ربات تلگرام می‌فرستد و مانده خودش را همان‌جا می‌بیند. اگر کد نسازید،
          کاربر امکان اتصال ندارد.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بررسی وضعیت اتصال‌ها...
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {users.map((u) => {
                const { enabled, link } = getState(u.id);
                return (
                  <li
                    key={u.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{u.displayName}</span>
                        {u.role === "admin" && (
                          <Badge className="h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                            ادمین
                          </Badge>
                        )}
                        {u.role === "user" && u.scope && (
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            {SCOPE_SHORT[u.scope]}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-[11px]">
                        <span className="font-mono text-muted-foreground" dir="ltr">
                          {u.username}
                        </span>
                        {link ? (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            متصل: {link.telegram_username ?? "بدون username"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" />
                            متصل نیست
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <div className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1">
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => void handleToggleEnabled(u.id, v)}
                          aria-label={`اجازه اتصال تلگرام برای ${u.displayName}`}
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          اجازه اتصال
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={generatingFor === u.id}
                        onClick={() => void handleGenerate(u.id, u.displayName)}
                      >
                        {generatingFor === u.id ? (
                          <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                        ) : (
                          <KeyRound className="h-3.5 w-3.5 ml-1" />
                        )}
                        ساخت کد اتصال
                      </Button>
                      {link && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs text-rose-600 hover:text-rose-700"
                              disabled={unlinkingFor === u.id}
                            >
                              {unlinkingFor === u.id ? (
                                <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" />
                              ) : (
                                <Link2Off className="h-3.5 w-3.5 ml-1" />
                              )}
                              قطع اتصال
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>قطع اتصال تلگرام</AlertDialogTitle>
                              <AlertDialogDescription>
                                اتصال تلگرام «{u.displayName}» قطع می‌شود. برای
                                اتصال مجدد، کاربر به کد جدید از شما نیاز دارد.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>انصراف</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void handleUnlink(u.id)}
                                className="bg-rose-600 hover:bg-rose-700"
                              >
                                قطع اتصال
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
        <div className="border-t p-3">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20 p-2.5 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              کد اتصال ۱۵ دقیقه اعتبار دارد و یک‌بار مصرف است. کاربر باید کد را
              در ربات تلگرام بفرستد (یا دستور{" "}
              <code dir="ltr" className="font-mono bg-muted px-1 rounded">
                /link کد
              </code>{" "}
              را بزند). با کلید «اجازه اتصال» هم می‌توانید دسترسی هر کاربر را
              کاملاً خاموش کنید.
            </p>
          </div>
        </div>
      </CardContent>

      {/* دیالوگ نمایش کد ساخته‌شده */}
      <Dialog open={!!codeDialog} onOpenChange={(open) => !open && setCodeDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              کد اتصال {codeDialog?.userName}
            </DialogTitle>
            <DialogDescription>
              این کد را به کاربر بدهید تا در ربات تلگرام بفرستد
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div
              dir="ltr"
              className="text-center text-4xl font-mono font-bold tracking-[0.35em] text-primary bg-primary/5 rounded-lg py-4 select-all"
            >
              {codeDialog ? toPersianDigits(codeDialog.code) : ""}
            </div>
            <div className="text-center text-xs text-muted-foreground space-y-1">
              <p className="flex items-center justify-center gap-1">
                <Link2 className="h-3 w-3" />
                اعتبار تا: {codeDialog ? new Date(codeDialog.expiresAt).toLocaleTimeString("fa-IR") : ""}
              </p>
              <p>کد ۱۵ دقیقه اعتبار دارد و فقط یک‌بار قابل استفاده است</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => codeDialog && void handleCopy(codeDialog.code)}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 ml-1 text-emerald-600" />
              ) : (
                <Copy className="h-4 w-4 ml-1" />
              )}
              {copied ? "کپی شد" : "کپی کد"}
            </Button>
            <Button onClick={() => setCodeDialog(null)}>تمام شد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

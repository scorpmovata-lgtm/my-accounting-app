"use client";

// صفحه ورود «وصـد» — Premium Fintech
// ---------------------------------------------------------------
// پس‌زمینه گرادیانی با هاله‌های زمردی + کارت شیشه‌ای + برندینگ ود.
// منطق ورود (موک/واقعی) بدون تغییر حفظ شده است.

import { useState } from "react";
import { BookOpenText, LogIn, Loader2, Moon, Sun, Info, Eye, EyeOff } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { APP_VERSION } from "@/lib/version";

export function LoginScreen() {
  const login = useAccountingStore((s) => s.login);
  const authError = useAccountingStore((s) => s.authError);
  const clearAuthError = useAccountingStore((s) => s.clearAuthError);
  const realMode = useAccountingStore((s) => s.realMode);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // مقادیر را مستقیم از DOM می‌خوانیم تا autofill مرورگر یا کیبورد فارسی
    // که onChange ری‌اکت را اجرا نمی‌کنند هم پوشش داده شود
    const fd = new FormData(e.currentTarget);
    const u = String(fd.get("username") ?? "");
    const p = String(fd.get("password") ?? "");
    setSubmitting(true);
    // تأخیر کوتاه برای UX
    await new Promise((r) => setTimeout(r, 250));
    const result = await login(u, p);
    setSubmitting(false);
    if (result.ok) {
      toast({ title: "ورود موفق", description: "خوش آمدید!" });
    } else {
      toast({
        title: "ورود ناموفق",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  function fillDemo(u: string) {
    setUsername(u);
    setPassword("1234");
    clearAuthError();
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-emerald-50/60 via-background to-background dark:from-emerald-950/25">
      {/* هاله‌های تزئینی */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-emerald-200/40 blur-3xl dark:bg-emerald-800/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 right-[-4rem] h-80 w-80 rounded-full bg-emerald-100/50 blur-3xl dark:bg-emerald-900/15"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-teal-100/40 blur-3xl dark:bg-teal-900/10"
        aria-hidden
      />

      {/* دکمه تم در گوشه */}
      <div className="relative z-10 flex justify-end p-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="تغییر تم"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md rounded-2xl border-border/60 bg-card/80 shadow-lift backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8">
            {/* برندینگ */}
            <div className="mb-6 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-bl from-emerald-500 to-emerald-700 shadow-fab">
                <BookOpenText className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">وصـد</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                دفتر بدهی و طلب — چندکاربری با دید دوجانبه
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  dir="ltr"
                  className="h-11 rounded-xl text-right"
                  placeholder="vahid"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (authError) clearAuthError();
                  }}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    dir="ltr"
                    className="h-11 rounded-xl pr-10 text-right"
                    placeholder="••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (authError) clearAuthError();
                    }}
                    disabled={submitting}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "پنهان کردن رمز" : "نمایش رمز"}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex h-11 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {authError && (
                <div className="space-y-2">
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                    {authError}
                  </div>
                  {realMode && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs leading-relaxed text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                      💡 اگر هنوز راه‌اندازی نکرده‌اید: ابتدا در Supabase
                      <span className="mx-1 font-mono">schema-v2.sql</span>
                      را اجرا کنید، سپس کاربر را در
                      <span dir="ltr" className="mx-1 font-mono">
                        Authentication → Users
                      </span>
                      با ایمیل
                      <span dir="ltr" className="mx-1 font-mono">
                        vahid@accounting.local
                      </span>
                      بسازید (گام ۱ و ۲ راهنمای راه‌اندازی).
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base font-bold shadow-fab"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="ml-2 h-4 w-4" />
                )}
                ورود به وصـد
              </Button>
            </form>

            {/* راهنمای ورود نمایشی — فقط در حالت موک */}
            {!realMode && (
              <div className="mt-5 space-y-2 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Info className="h-3.5 w-3.5" />
                  حساب‌های نمایشی (رمز همه: {toPersianDigits("1234")})
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { u: "vahid", label: "وحید — ادمین" },
                    { u: "faezeh", label: "فائزه — کاربر با تراکنش‌ها" },
                    { u: "maryam", label: "مریم — فقط مشاهده مانده" },
                  ].map((d) => (
                    <button
                      key={d.u}
                      type="button"
                      onClick={() => fillDemo(d.u)}
                      className="flex items-center justify-between rounded-lg border border-emerald-200/50 bg-white/70 px-2.5 py-2 text-right text-xs transition-colors hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800/50 dark:bg-background/40 dark:hover:bg-emerald-950/30"
                    >
                      <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                        {d.u}
                      </span>
                      <span className="text-muted-foreground">{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="relative z-10 border-t bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-muted-foreground">
          وصـد — نسخه {toPersianDigits(APP_VERSION)}
        </div>
      </footer>
    </div>
  );
}

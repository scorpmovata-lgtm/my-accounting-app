"use client";

import { useState } from "react";
import { BookOpenText, LogIn, Loader2, Moon, Sun, Info, Eye, EyeOff } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAccountingStore } from "@/store/accounting-store";
import { useToast } from "@/hooks/use-toast";
import { toPersianDigits } from "@/lib/accounting/jalali";

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
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/40 to-background dark:from-emerald-950/20">
      {/* دکمه تم در گوشه */}
      <div className="flex justify-end p-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label="تغییر تم"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <BookOpenText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">دفتر حسابداری</CardTitle>
              <CardDescription className="mt-1">
                بدهی و طلب شخصی — چندکاربری با تطابق خودکار
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">نام کاربری</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  dir="ltr"
                  className="text-right"
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
                    className="text-right pl-10"
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
                    className="absolute inset-y-0 left-0 flex h-11 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
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
                  <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-2.5 text-sm text-rose-700 dark:text-rose-300">
                    {authError}
                  </div>
                  {realMode && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-2.5 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      💡 اگر هنوز راه‌اندازی نکرده‌اید: ابتدا در Supabase
                      <span className="font-mono mx-1">schema-v2.sql</span>
                      را اجرا کنید، سپس کاربر را در
                      <span dir="ltr" className="font-mono mx-1">
                        Authentication → Users
                      </span>
                      با ایمیل
                      <span dir="ltr" className="font-mono mx-1">
                        vahid@accounting.local
                      </span>
                      بسازید (گام ۱ و ۲ راهنمای راه‌اندازی).
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4 ml-2" />
                )}
                ورود
              </Button>
            </form>

            {/* راهنمای ورود نمایشی — فقط در حالت موک */}
            {!realMode && (
            <div className="mt-5 rounded-lg border border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
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
                    className="flex items-center justify-between text-right text-xs rounded-md border border-emerald-200/50 dark:border-emerald-800/50 bg-white/70 dark:bg-background/40 px-2.5 py-1.5 hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
                  >
                    <span className="font-mono text-emerald-700 dark:text-emerald-400">
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

      <footer className="border-t bg-card/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 text-center text-xs text-muted-foreground">
          دفتر حسابداری — نسخه {toPersianDigits("3.0")} (چندکاربری)
        </div>
      </footer>
    </div>
  );
}

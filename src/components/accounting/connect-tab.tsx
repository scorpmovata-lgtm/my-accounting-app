"use client";

import { useEffect, useState } from "react";
import {
  Cloud,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Database,
  User,
  Loader2,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useAccountingStore } from "@/store/accounting-store";
import {
  getSupabaseConfig,
  setSupabaseConfig,
  clearSupabaseConfig,
  SupabaseConfig,
} from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ConnectTab() {
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const authError = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const refresh = useAuthStore((s) => s.refresh);

  const realMode = useAccountingStore((s) => s.realMode);
  const activateRealMode = useAccountingStore((s) => s.activateRealMode);
  const deactivateRealMode = useAccountingStore((s) => s.deactivateRealMode);

  const { toast } = useToast();

  // برای جلوگیری از hydration mismatch، localStorage را فقط بعد از mount می‌خوانیم
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<SupabaseConfig | null>(null);

  useEffect(() => {
    setMounted(true);
    setConfig(getSupabaseConfig());
  }, []);

  // فعال‌سازی real mode هنگام login موفق
  useEffect(() => {
    if (authStatus === "authenticated" && authUser && !realMode && config) {
      // activate real mode با ledgerId کاربر (admin بدون ledgerId است)
      if (authUser.ledgerId) {
        void activateRealMode(authUser.ledgerId, authUser.displayName ?? "صاحب دفتر");
      }
    }
    if (authStatus === "anonymous" && realMode) {
      deactivateRealMode();
    }
  }, [authStatus, authUser, realMode, config, activateRealMode, deactivateRealMode]);

  const [url, setUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  function handleSaveConfig() {
    setSavingConfig(true);
    clearError();
    try {
      const u = url.trim();
      const k = anonKey.trim();
      if (!u || !k) {
        toast({
          title: "خطا",
          description: "URL و anon key را وارد کنید.",
          variant: "destructive",
        });
        setSavingConfig(false);
        return;
      }
      // اعتبارسنجی ساده URL
      try {
        new URL(u);
      } catch {
        toast({
          title: "خطا",
          description: "URL نامعتبر است. مثال: https://xyz.supabase.co",
          variant: "destructive",
        });
        setSavingConfig(false);
        return;
      }
      setSupabaseConfig(u, k);
      toast({
        title: "تنظیمات ذخیره شد",
        description: "صفحه برای اعمال تنظیمات بارگذاری مجدد می‌شود.",
      });
      // Reload صفحه برای ساخت کلاینت جدید با تنظیمات جدید
      setTimeout(() => {
        window.location.reload();
      }, 600);
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleClearConfig() {
    clearSupabaseConfig();
    setConfig(null);
    setUrl("");
    setAnonKey("");
    toast({
      title: "تنظیمات پاک شد",
      description: "برای اتصال مجدد، URL و anon key جدید وارد کنید.",
    });
  }

  async function handleLogin() {
    setSigningIn(true);
    clearError();
    try {
      await login(email.trim(), password);
      toast({
        title: "ورود موفق",
        description: "به دفتر حسابداری متصل شدید.",
      });
      setEmail("");
      setPassword("");
    } catch (e) {
      toast({
        title: "خطا در ورود",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setSigningIn(false);
    }
  }

  async function handleLogout() {
    await logout();
    toast({
      title: "خروج انجام شد",
      description: "نشست شما بسته شد.",
    });
  }

  async function handleRefresh() {
    await refresh();
    toast({
      title: "وضعیت به‌روزرسانی شد",
    });
  }

  const isLoggedIn = authStatus === "authenticated" && !!authUser;
  const hasConfig = !!config;

  // پیشگیری از رندر پیش از mount (جلوگیری از hydration mismatch)
  if (!mounted) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
            در حال بارگذاری...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* کارت وضعیت */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Database className="h-5 w-5" />
            وضعیت اتصال
            <div className="flex flex-wrap gap-1 mr-auto">
              <Badge
                variant="outline"
                className={
                  hasConfig
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }
              >
                {hasConfig ? "تنظیمات ✓" : "بدون تنظیمات"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  isLoggedIn
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                }
              >
                {isLoggedIn ? "وارد شده ✓" : "میهمان"}
              </Badge>
              <Badge
                variant="outline"
                className={
                  realMode
                    ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                }
              >
                {realMode ? "داده واقعی" : "داده موک"}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            اتصال به پروژه Supabase شما. پس از ذخیره تنظیمات و ورود، اپ به‌جای داده موک،
            داده واقعی شما را نشان می‌دهد.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {hasConfig && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="font-medium mb-1 flex items-center gap-2">
                <Cloud className="h-4 w-4" />
                پروژه Supabase
              </div>
              <div className="text-xs text-muted-foreground" dir="ltr">
                {config.url}
              </div>
            </div>
          )}
          {isLoggedIn && authUser && (
            <div className="rounded-md border p-3 bg-muted/30">
              <div className="font-medium mb-1 flex items-center gap-2">
                <User className="h-4 w-4" />
                کاربر
              </div>
              <div className="text-xs">
                {authUser.displayName ?? "بدون نام"} • {authUser.email ?? "بدون ایمیل"}
                {authUser.isAdmin && (
                  <Badge variant="secondary" className="mr-2">
                    ادمین
                  </Badge>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {isLoggedIn && (
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 ml-1" />
                به‌روزرسانی
              </Button>
            )}
            {hasConfig && (
              <Button size="sm" variant="ghost" onClick={handleClearConfig}>
                پاک کردن تنظیمات
              </Button>
            )}
          </div>
          {authError && (
            <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* مرحله ۱: تنظیمات Supabase */}
      {!hasConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              مرحله ۱: تنظیمات Supabase
            </CardTitle>
            <CardDescription>
              URL پروژه و anon key را از داشبارد Supabase → Settings → API بردارید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="sb-url">URL پروژه</Label>
              <Input
                id="sb-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://xyz.supabase.co"
                dir="ltr"
                className="text-left"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sb-anon">anon key</Label>
              <Input
                id="sb-anon"
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGci..."
                dir="ltr"
                className="text-left font-mono"
              />
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={savingConfig || !url.trim() || !anonKey.trim()}
            >
              {savingConfig ? (
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 ml-1" />
              )}
              ذخیره تنظیمات
            </Button>
            <div className="text-xs text-muted-foreground pt-2 border-t">
              راهنما: anon key یک کلید عمومی است که با RLS محدود شده است. این
              کلید به‌تنهایی اجازه دسترسی به داده‌های دیگر کاربران را نمی‌دهد.
            </div>
          </CardContent>
        </Card>
      )}

      {/* مرحله ۲: ورود */}
      {hasConfig && !isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-5 w-5" />
              مرحله ۲: ورود
            </CardTitle>
            <CardDescription>
              با حساب Supabase Auth خود وارد شوید. اگر کاربری ندارید، ادمین می‌تواند
              از تب «مدیریت» برای شما حساب بسازد.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="login-email">ایمیل</Label>
              <Input
                id="login-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                dir="ltr"
                className="text-left"
                autoComplete="email"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="login-pass">رمز عبور</Label>
              <Input
                id="login-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="text-left"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
            </div>
            <Button
              onClick={handleLogin}
              disabled={signingIn || !email.trim() || !password}
            >
              {signingIn ? (
                <Loader2 className="h-4 w-4 ml-1 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4 ml-1" />
              )}
              ورود
            </Button>
          </CardContent>
        </Card>
      )}

      {/* خروج */}
      {isLoggedIn && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5" />
              خروج
            </CardTitle>
            <CardDescription>
              برای جابجایی بین حساب‌ها یا حفاظت امنیتی، از نشست خود خارج شوید.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="h-4 w-4 ml-1" />
              خروج از حساب
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

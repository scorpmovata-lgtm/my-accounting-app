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
  clearSupabaseConfig,
  getSupabaseConfig,
  setSupabaseConfig,
  type SupabaseConfig,
} from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ConnectTab() {
  const { toast } = useToast();
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const authError = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const init = useAuthStore((s) => s.init);
  const refresh = useAuthStore((s) => s.refresh);
  const clearError = useAuthStore((s) => s.clearError);

  const realMode = useAccountingStore((s) => s.realMode);
  const activateRealMode = useAccountingStore((s) => s.activateRealMode);
  const deactivateRealMode = useAccountingStore((s) => s.deactivateRealMode);
  const loadRealData = useAccountingStore((s) => s.loadRealData);

  // مهم: localStorage فقط بعد از mount خوانده می‌شود تا hydration mismatch نباشد
  const [config, setConfig] = useState<SupabaseConfig | null>(null);
  const [mounted, setMounted] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [anonInput, setAnonInput] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setConfig(getSupabaseConfig());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const unsubscribe = init();
    return () => {
      unsubscribe();
    };
  }, [config, mounted]);

  useEffect(() => {
    if (authStatus === "authenticated" && authUser?.ledgerId && !realMode) {
      activateRealMode(
        authUser.ledgerId,
        authUser.displayName ?? authUser.email ?? "کاربر"
      );
    } else if (authStatus === "anonymous" && realMode) {
      deactivateRealMode();
    }
  }, [authStatus, authUser, realMode]);

  function handleSaveConfig() {
    if (!urlInput.trim() || !anonInput.trim()) {
      toast({
        title: "خطا",
        description: "هم URL و هم anon key باید پر شوند.",
        variant: "destructive",
      });
      return;
    }
    setSupabaseConfig(urlInput.trim(), anonInput.trim());
    setConfig(getSupabaseConfig());
    setUrlInput("");
    setAnonInput("");
    toast({
      title: "ذخیره شد",
      description: "پیکربندی Supabase ذخیره شد. حالا می‌توانید وارد شوید.",
    });
  }

  function handleClearConfig() {
    clearSupabaseConfig();
    setConfig(null);
    deactivateRealMode();
    toast({
      title: "پاک شد",
      description: "پیکربندی Supabase پاک شد.",
    });
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      toast({
        title: "خطا",
        description: "ایمیل و رمز را وارد کنید.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    clearError();
    try {
      await login(email.trim(), password);
      toast({
        title: "وارد شدید",
        description: "به دفتر حسابداری خودتان خوش آمدید.",
      });
    } catch {
      // error is in authError
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    await logout();
    toast({
      title: "خارج شدید",
      description: "جلسه پایان یافت.",
    });
  }

  async function handleRefresh() {
    setSubmitting(true);
    try {
      await refresh();
      await loadRealData();
      toast({
        title: "بازخوانی",
        description: "داده‌ها از Supabase تازه شدند.",
      });
    } catch (e) {
      toast({
        title: "خطا",
        description: e instanceof Error ? e.message : "خطای ناشناخته",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const isConfigured = config !== null;

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Cloud className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <div className="font-medium">فاز ۳ — اتصال به Supabase واقعی</div>
              <p className="text-muted-foreground leading-relaxed">
                وقتی وارد شوی، همه تب‌ها (داشبورد، تراکنش‌ها، ...) داده واقعی
                نشان می‌دهند و فرم ثبت تراکنش از طریق Edge Function امن ثبت
                می‌کند.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            مرحله ۱ — پیکربندی Supabase
            {isConfigured ? (
              <Badge className="mr-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3 ml-1" />
                ذخیره شده
              </Badge>
            ) : (
              <Badge variant="outline" className="mr-auto text-muted-foreground">
                <AlertCircle className="h-3 w-3 ml-1" />
                نیاز به تنظیم
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            این مقادیر را از داشبورد Supabase → Settings → API بگیر.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isConfigured ? (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Project URL:</span>{" "}
                <code
                  className="text-foreground bg-muted px-1 py-0.5 rounded text-xs"
                  dir="ltr"
                >
                  {config?.url}
                </code>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">anon key:</span>{" "}
                <code
                  className="text-foreground bg-muted px-1 py-0.5 rounded text-xs"
                  dir="ltr"
                >
                  {config?.anonKey.slice(0, 20)}...
                </code>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleClearConfig}>
                  پاک کردن پیکربندی
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                این مقادیر در localStorage مرورگر شما ذخیره شده‌اند.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="supabase-url">Project URL</Label>
                <Input
                  id="supabase-url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://abcd.supabase.co"
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supabase-anon">anon public key</Label>
                <Input
                  id="supabase-anon"
                  value={anonInput}
                  onChange={(e) => setAnonInput(e.target.value)}
                  placeholder="eyJhbGciOi..."
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <Button
                onClick={handleSaveConfig}
                disabled={!urlInput.trim() || !anonInput.trim()}
              >
                ذخیره پیکربندی
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isConfigured && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogIn className="h-5 w-5" />
              مرحله ۲ — ورود
              {authStatus === "authenticated" && (
                <Badge className="mr-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  وارد شده
                </Badge>
              )}
              {authStatus === "anonymous" && (
                <Badge
                  variant="outline"
                  className="mr-auto text-amber-700 border-amber-300"
                >
                  <AlertCircle className="h-3 w-3 ml-1" />
                  وارد نشده
                </Badge>
              )}
              {authStatus === "loading" && (
                <Badge variant="outline" className="mr-auto">
                  <Loader2 className="h-3 w-3 ml-1 animate-spin" />
                  در حال بررسی
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              با همان حسابی که در Authentication → Users ساختی وارد شو.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {authStatus === "authenticated" && authUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20">
                  <User className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                  <div className="text-sm">
                    <div className="font-medium">
                      {authUser.displayName ?? "کاربر"}
                    </div>
                    <div className="text-muted-foreground" dir="ltr">
                      {authUser.email}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  شناسه دفتر:{" "}
                  <code className="text-foreground" dir="ltr">
                    {authUser.ledgerId?.slice(0, 8)}...
                  </code>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 ml-1" />
                    خروج
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 ml-1" />
                    )}
                    بازخوانی داده
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="email">ایمیل</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="test@example.com"
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">رمز</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="text-left"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLogin();
                    }}
                  />
                </div>
                {authError && (
                  <div className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {authError}
                  </div>
                )}
                <Button onClick={handleLogin} disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                      در حال ورود...
                    </>
                  ) : (
                    "ورود"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="h-5 w-5" />
            وضعیت فعلی
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span>پیکربندی Supabase</span>
              {isConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span>احراز هویت</span>
              {authStatus === "authenticated" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : authStatus === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600" />
              )}
            </div>
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <span>حالت داده</span>
              <Badge variant={realMode ? "default" : "secondary"}>
                {realMode ? "واقعی (Supabase)" : "موک"}
              </Badge>
            </div>
          </div>

          {authStatus === "authenticated" && realMode && (
            <div className="mt-4 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/20 text-sm">
              <div className="font-medium text-emerald-800 dark:text-emerald-300 mb-1">
                ✅ متصل و وارد شده
              </div>
              <p className="text-emerald-700/80 dark:text-emerald-400/80">
                حالا تب «داشبورد» را بزن — داده واقعی از Supabase می‌آید.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

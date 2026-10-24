"use client";

import { useEffect, useState } from "react";
import {
  BookOpenText,
  Moon,
  Sun,
  LogOut,
  Cloud,
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useAccountingStore } from "@/store/accounting-store";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { useToast } from "@/hooks/use-toast";
import { ConnectTab } from "./connect-tab";
import { AdminTab } from "./admin-tab";
import { DashboardPanel } from "./dashboard-panel";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { CategoriesPanel } from "./categories-panel";
import { TelegramLinkPanel } from "./telegram-link-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { SetupTab } from "./setup-tab";

const VALID_TABS = [
  "connect",
  "dashboard",
  "transactions",
  "categories",
  "telegram",
  "admin",
  "audit",
  "setup",
] as const;

type TabValue = (typeof VALID_TABS)[number];

function isTabValue(v: string): v is TabValue {
  return (VALID_TABS as readonly string[]).includes(v);
}

export function AppShell() {
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const init = useAuthStore((s) => s.init);
  const logout = useAuthStore((s) => s.logout);

  const ledger = useAccountingStore((s) => s.ledger);
  const realMode = useAccountingStore((s) => s.realMode);

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("dashboard");

  // init احراز هویت — فقط در mount
  useEffect(() => {
    const unsubscribe = init();
    return () => {
      unsubscribe();
    };
  }, [init]);

  const isLoggedIn = authStatus === "authenticated" && !!authUser;
  const isAdmin = isLoggedIn && !!authUser?.isAdmin;

  // اگر کاربر وارد نشده و روی تب غیر از setup است، به connect برگردان
  const effectiveTab: string =
    !isLoggedIn && tab !== "setup" && tab !== "connect" ? "connect" : tab;

  // اگر تب فعلی admin-only است و کاربر admin نیست، به connect برگردان
  const adminOnlyTabs: TabValue[] = ["telegram", "admin", "audit"];
  const finalTab =
    adminOnlyTabs.includes(effectiveTab as TabValue) && !isAdmin
      ? "connect"
      : effectiveTab;

  async function handleLogout() {
    await logout();
    toast({
      title: "خروج انجام شد",
      description: "نشست شما بسته شد.",
    });
    setTab("connect");
  }

  // صفحه بارگذاری هنگام بررسی نشست
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">
          در حال بررسی نشست...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpenText className="h-6 w-6 text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold leading-tight truncate">
                {ledger.name}
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {isLoggedIn
                  ? `صاحب دفتر: ${authUser?.displayName ?? "نامشخص"}`
                  : "میهمان — لطفاً وارد شوید"}
              </span>
            </div>
            {realMode && (
              <Badge
                variant="secondary"
                className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 mr-1 shrink-0"
              >
                <Cloud className="h-3 w-3 ml-1" />
                متصل
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="h-9"
                title="خروج"
              >
                <LogOut className="h-4 w-4 ml-1" />
                خروج
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="تغییر تم"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4">
        <Tabs
          value={finalTab}
          onValueChange={(v) => {
            if (isTabValue(v)) setTab(v);
          }}
        >
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-8 mb-4 w-full">
            <TabsTrigger value="connect">اتصال</TabsTrigger>
            <TabsTrigger value="dashboard">داشبورد</TabsTrigger>
            <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
            <TabsTrigger value="categories">سرفصل‌ها</TabsTrigger>
            <TabsTrigger value="setup">راه‌اندازی</TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="telegram">تلگرام</TabsTrigger>
                <TabsTrigger value="admin">مدیریت</TabsTrigger>
                <TabsTrigger value="audit">ممیزی</TabsTrigger>
              </>
            )}
          </TabsList>
          <TabsContent value="connect" className="mt-0 focus-visible:outline-none">
            <ConnectTab />
          </TabsContent>
          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <DashboardPanel />
          </TabsContent>
          <TabsContent value="transactions" className="mt-0 focus-visible:outline-none">
            <div className="space-y-4">
              {isLoggedIn ? (
                <div className="flex justify-end">
                  <TransactionFormDialog />
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                  برای ثبت تراکنش ابتدا از تب «اتصال» وارد شوید.
                </div>
              )}
              <TransactionsTable />
            </div>
          </TabsContent>
          <TabsContent value="categories" className="mt-0 focus-visible:outline-none">
            <CategoriesPanel />
          </TabsContent>
          <TabsContent value="setup" className="mt-0 focus-visible:outline-none">
            <SetupTab />
          </TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="telegram" className="mt-0 focus-visible:outline-none">
                <TelegramLinkPanel />
              </TabsContent>
              <TabsContent value="admin" className="mt-0 focus-visible:outline-none">
                <AdminTab />
              </TabsContent>
              <TabsContent value="audit" className="mt-0 focus-visible:outline-none">
                <AuditLogPanel />
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      <footer className="border-t bg-card/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>دفتر حسابداری — نسخه {toPersianDigits("0.2")}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>ساخته‌شده با Next.js</span>
            <span aria-hidden>•</span>
            <span>متصل به Supabase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

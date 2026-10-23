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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAccountingStore } from "@/store/accounting-store";
import { useAuthStore } from "@/store/auth-store";
import { getSupabaseConfig } from "@/lib/supabase/client";
import { DashboardPanel } from "./dashboard-panel";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { CategoriesPanel } from "./categories-panel";
import { TelegramLinkPanel } from "./telegram-link-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { SetupTab } from "./setup-tab";
import { ConnectTab } from "./connect-tab";
import { toPersianDigits } from "@/lib/accounting/jalali";

export function AppShell() {
  const ledger = useAccountingStore((s) => s.ledger);
  const realMode = useAccountingStore((s) => s.realMode);
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const init = useAuthStore((s) => s.init);
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("dashboard");

  // init() را در AppShell فراخوانی کن (نه در ConnectTab)
  // این کار تضمین می‌کند که حتی در loading state، auth بررسی شود
  useEffect(() => {
    // اگر config در localStorage هست، init() آن را تشخیص می‌دهد
    const unsubscribe = init();
    return () => {
      unsubscribe();
    };
  }, [init]);

  const isLoggedIn = authStatus === "authenticated" && authUser;
  // فقط صاحب دفتر (admin) به تب تلگرام و راه‌اندازی دسترسی دارد
  const isAdmin = isLoggedIn && authUser?.isAdmin;

  // اگر کاربر وارد نشده، همیشه تب «اتصال» را نمایش بده
  const effectiveTab = !isLoggedIn ? "connect" : tab;

  async function handleLogout() {
    await logout();
    setTab("connect");
  }

  // صفحه loading هنگام چک کردن session
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <BookOpenText className="h-12 w-12 text-primary" />
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>در حال بارگذاری...</span>
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
              <span className="text-xs text-muted-foreground leading-tight truncate">
                {isLoggedIn
                  ? `کاربر: ${
                      authUser?.displayName ?? authUser?.email ?? "—"
                    }${isAdmin ? " • ادمین" : ""}`
                  : `صاحب دفتر (موک): ${ledger.ownerName}`}
              </span>
            </div>
            {realMode && (
              <Badge
                variant="outline"
                className="hidden sm:inline-flex bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs mr-1"
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
                className="text-muted-foreground"
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
        <Tabs value={effectiveTab} onValueChange={setTab}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4 w-full">
            <TabsTrigger value="connect" className="text-xs sm:text-sm flex-1 min-w-[80px]">
              اتصال
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="text-xs sm:text-sm flex-1 min-w-[80px]">
              داشبورد
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs sm:text-sm flex-1 min-w-[80px]">
              تراکنش‌ها
            </TabsTrigger>
            <TabsTrigger value="categories" className="text-xs sm:text-sm flex-1 min-w-[80px]">
              سرفصل‌ها
            </TabsTrigger>
            {/* فقط admin تب‌های زیر را می‌بیند */}
            {isAdmin && (
              <TabsTrigger value="telegram" className="text-xs sm:text-sm flex-1 min-w-[80px]">
                تلگرام
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="audit" className="text-xs sm:text-sm flex-1 min-w-[80px]">
                ممیزی
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="setup" className="text-xs sm:text-sm flex-1 min-w-[80px]">
                راه‌اندازی
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent
            value="connect"
            className="mt-0 focus-visible:outline-none"
          >
            <ConnectTab />
          </TabsContent>
          <TabsContent
            value="dashboard"
            className="mt-0 focus-visible:outline-none"
          >
            <DashboardPanel />
          </TabsContent>
          <TabsContent
            value="transactions"
            className="mt-0 focus-visible:outline-none"
          >
            <div className="space-y-4">
              <div className="flex justify-end">
                <TransactionFormDialog />
              </div>
              <TransactionsTable />
            </div>
          </TabsContent>
          <TabsContent
            value="categories"
            className="mt-0 focus-visible:outline-none"
          >
            <CategoriesPanel />
          </TabsContent>
          {isAdmin && (
            <TabsContent
              value="telegram"
              className="mt-0 focus-visible:outline-none"
            >
              <TelegramLinkPanel />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent
              value="audit"
              className="mt-0 focus-visible:outline-none"
            >
              <AuditLogPanel />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent
              value="setup"
              className="mt-0 focus-visible:outline-none"
            >
              <SetupTab />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="border-t bg-card/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            دفتر حسابداری — نسخه {toPersianDigits("1.1")}{" "}
            {isAdmin ? "(ادمین)" : ""}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>ساخته‌شده با Next.js + Supabase</span>
            <span aria-hidden>•</span>
            <span>مطابق سند طراحی «مرحله صفر»</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

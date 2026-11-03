"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  BookOpenText,
  Moon,
  Sun,
  LogOut,
  Menu,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  User as UserIcon,
  PlusCircle,
  List as ListIcon,
  Rocket,
  Loader2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAccountingStore } from "@/store/accounting-store";
import { toPersianDigits } from "@/lib/accounting/jalali";
import { useToast } from "@/hooks/use-toast";
import { LoginScreen } from "./login-screen";
import { DashboardPanel } from "./dashboard-panel";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { AdminTab } from "./admin-tab";
import { SetupTab } from "./setup-tab";
import { TelegramLinkPanel } from "./telegram-link-panel";

type TabValue = "dashboard" | "transactions" | "telegram" | "admin" | "setup";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  hiddenForBalanceOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  {
    value: "dashboard",
    label: "داشبورد",
    icon: LayoutDashboard,
  },
  {
    value: "transactions",
    label: "تراکنش‌ها",
    icon: Receipt,
    hiddenForBalanceOnly: true,
  },
  {
    value: "telegram",
    label: "تلگرام",
    icon: Send,
  },
  {
    value: "admin",
    label: "مدیریت",
    icon: Settings,
    adminOnly: true,
  },
  {
    value: "setup",
    label: "راه‌اندازی",
    icon: Rocket,
    adminOnly: true,
  },
];

export function AppShell() {
  const authStatus = useAccountingStore((s) => s.authStatus);
  const currentUserId = useAccountingStore((s) => s.currentUserId);
  const users = useAccountingStore((s) => s.users);
  const logout = useAccountingStore((s) => s.logout);
  const initRealSession = useAccountingStore((s) => s.initRealSession);
  const realMode = useAccountingStore((s) => s.realMode);

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);

  // بازیابی نشست ذخیره‌شده هنگام mount (فقط حالت واقعی)
  useEffect(() => {
    if (realMode) {
      void initRealSession();
    }
  }, []);

  const currentUser = users.find((u) => u.id === currentUserId);
  const isLoggedIn = authStatus === "authenticated" && !!currentUser;
  const isAdmin = isLoggedIn && currentUser?.role === "admin";
  const isBalanceOnly =
    isLoggedIn && currentUser?.role === "user" && currentUser?.scope === "balance_only";

  // صفحه بارگذاری هنگام بررسی نشست (حالت واقعی)
  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm text-muted-foreground">در حال بررسی نشست...</div>
      </div>
    );
  }

  // اگر هنوز احراز هویت نشده، صفحه ورود
  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // محاسبه تب قابل نمایش
  function computeFinalTab(desired: string): TabValue {
    if ((desired === "admin" || desired === "setup") && !isAdmin)
      return "dashboard";
    if (desired === "transactions" && isBalanceOnly) return "dashboard";
    return desired as TabValue;
  }

  const finalTab = computeFinalTab(tab);

  function selectTab(value: TabValue) {
    setTab(value);
    setMenuOpen(false);
  }

  async function handleLogout() {
    await logout();
    toast({ title: "خروج انجام شد", description: "نشست شما بسته شد." });
    setTab("dashboard");
    setMenuOpen(false);
  }

  const visibleNavItems = ALL_NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hiddenForBalanceOnly && isBalanceOnly) return false;
    return true;
  });

  let activeContent: React.ReactNode = null;
  switch (finalTab) {
    case "dashboard":
      activeContent = <DashboardPanel />;
      break;
    case "transactions":
      activeContent = (
        <div className="space-y-4">
          {!isBalanceOnly && (
            <div className="flex justify-end">
              <TransactionFormDialog />
            </div>
          )}
          <TransactionsTable />
        </div>
      );
      break;
    case "telegram":
      activeContent = <TelegramLinkPanel />;
      break;
    case "admin":
      activeContent = <AdminTab />;
      break;
    case "setup":
      activeContent = <SetupTab />;
      break;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-2">
          {/* همبرگر در سمت راست (اول در RTL) */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="باز کردن منو"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 flex flex-col">
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <BookOpenText className="h-5 w-5 text-primary" />
                  منوی اصلی
                </SheetTitle>
              </SheetHeader>

              <nav className="flex-1 overflow-y-auto scrollbar-persian p-2 space-y-1">
                {visibleNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = finalTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => selectTab(item.value)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors text-right ${
                        isActive
                          ? "bg-primary text-primary-foreground font-medium"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-right">{item.label}</span>
                      {item.adminOnly && !isActive && (
                        <Badge
                          variant="outline"
                          className="h-4 px-1.5 text-[10px] gap-0.5"
                        >
                          <ShieldCheck className="h-2.5 w-2.5" />
                          ادمین
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* بخش پایین: کاربر + تم + خروج */}
              <div className="border-t p-3 space-y-2 mt-auto">
                <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    <UserIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{currentUser.displayName}</span>
                    {isAdmin ? (
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px] mr-auto">
                        ادمین
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px] mr-auto">
                        {isBalanceOnly ? "فقط مانده" : "تراکنش‌ها"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-muted-foreground truncate font-mono" dir="ltr">
                    {currentUser.username}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    aria-label="تغییر تم"
                  >
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 ml-1" />
                    <Moon className="h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 ml-1" />
                    {theme === "dark" ? "روشن" : "تاریک"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    aria-label="خروج"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <LogOut className="h-4 w-4 ml-1" />
                    خروج
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* نام اپ + کاربر */}
          <BookOpenText className="h-6 w-6 text-primary shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold leading-tight truncate">
              {currentUser.displayName}
            </span>
            <span className="text-xs text-muted-foreground leading-tight truncate">
              دفتر {currentUser.username}
              {isAdmin && " — ادمین"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4 sm:py-6 pb-24">
        {activeContent}
      </main>

      {/* منوی پایین صفحه */}
      {!isBalanceOnly && (
        <nav
          className="fixed bottom-0 inset-x-0 z-50 border-t bg-card/95 backdrop-blur-md"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="منوی دسترسی سریع"
        >
          <div className="mx-auto max-w-6xl grid grid-cols-3">
            <button
              type="button"
              onClick={() => setTxDialogOpen(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground hover:text-primary transition-colors"
              aria-label="افزودن تراکنش"
            >
              <PlusCircle className="h-5 w-5" />
              <span className="text-[11px] font-medium">افزودن تراکنش</span>
            </button>
            <button
              type="button"
              onClick={() => selectTab("transactions")}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                finalTab === "transactions"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
              aria-label="لیست تراکنش‌ها"
            >
              <ListIcon className="h-5 w-5" />
              <span className="text-[11px] font-medium">لیست تراکنش‌ها</span>
            </button>
            <button
              type="button"
              onClick={() => selectTab("dashboard")}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
                finalTab === "dashboard"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-primary"
              }`}
              aria-label="داشبورد"
            >
              <LayoutDashboard className="h-5 w-5" />
              <span className="text-[11px] font-medium">داشبورد</span>
            </button>
          </div>
        </nav>
      )}

      {/* دیالوگ افزودن تراکنش */}
      {!isBalanceOnly && (
        <TransactionFormDialog open={txDialogOpen} onOpenChange={setTxDialogOpen} />
      )}

      <footer className="border-t bg-card/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>دفتر حسابداری — نسخه {toPersianDigits("2.0")} (چندکاربری)</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>تطابق خودکار بین‌کاربری</span>
            <span aria-hidden>•</span>
            <span>تقویم شمسی</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

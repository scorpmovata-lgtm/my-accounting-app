"use client";

// App Shell «دفتر حساب کتاب» — قاب Premium SaaS
// ---------------------------------------------------------------
// دسکتاپ (lg+): سایدبار ثابت راست‌چین (قابل جمع‌شدن) + نوار بالا شیشه‌ای
// موبایل: نوار بالای فشرده + منوی پایین با دکمه شناور «ثبت تراکنش»
// منطق تب‌ها، نقش‌ها و دسترسی‌ها بدون تغییر حفظ شده است.

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
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Home,
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
import { APP_VERSION } from "@/lib/version";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LoginScreen } from "./login-screen";
import { DashboardPanel } from "./dashboard-panel";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { AdminTab } from "./admin-tab";
import { SetupTab } from "./setup-tab";
import { TelegramLinkPanel } from "./telegram-link-panel";
import { PersonalSettingsPanel } from "./categories-panel";

type TabValue =
  | "dashboard"
  | "transactions"
  | "telegram"
  | "personal"
  | "admin"
  | "setup";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  hiddenForBalanceOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { value: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  {
    value: "transactions",
    label: "تراکنش‌ها",
    icon: Receipt,
    hiddenForBalanceOnly: true,
  },
  { value: "telegram", label: "تلگرام", icon: Send },
  {
    value: "personal",
    label: "تنظیمات من",
    icon: Settings,
    hiddenForBalanceOnly: true,
  },
  {
    value: "admin",
    label: "مدیریت سامانه",
    icon: ShieldCheck,
    adminOnly: true,
  },
  {
    value: "setup",
    label: "راه‌اندازی",
    icon: Rocket,
    adminOnly: true,
  },
];

const TAB_TITLES: Record<TabValue, string> = {
  dashboard: "داشبورد",
  transactions: "تراکنش‌ها",
  telegram: "تلگرام",
  personal: "تنظیمات من",
  admin: "مدیریت سامانه",
  setup: "راه‌اندازی",
};

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
  const [collapsed, setCollapsed] = useState(false);

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
              <TransactionFormDialog
                trigger={
                  <Button className="rounded-xl shadow-fab">
                    <Plus className="h-4 w-4" />
                    ثبت تراکنش جدید
                  </Button>
                }
              />
            </div>
          )}
          <TransactionsTable />
        </div>
      );
      break;
    case "telegram":
      activeContent = <TelegramLinkPanel />;
      break;
    case "personal":
      activeContent = <PersonalSettingsPanel />;
      break;
    case "admin":
      activeContent = <AdminTab />;
      break;
    case "setup":
      activeContent = <SetupTab />;
      break;
  }

  // ------------------------- آیتم منو (مشترک) -------------------------
  function NavButton({
    item,
    compact = false,
  }: {
    item: NavItem;
    compact?: boolean;
  }) {
    const Icon = item.icon;
    const isActive = finalTab === item.value;
    return (
      <button
        type="button"
        onClick={() => selectTab(item.value)}
        title={compact ? item.label : undefined}
        className={cn(
          "group relative flex w-full items-center rounded-xl text-sm transition-all duration-200",
          compact ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
          isActive
            ? "bg-accent font-semibold text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-current={isActive ? "page" : undefined}
      >
        {/* نشانگر فعال لبه راست (RTL) */}
        {isActive && (
          <span
            className="absolute right-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary"
            aria-hidden
          />
        )}
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0",
            isActive && "text-primary"
          )}
        />
        {!compact && <span className="flex-1 text-right">{item.label}</span>}
        {!compact && item.adminOnly && (
          <Badge
            variant="outline"
            className="h-4 gap-0.5 px-1.5 text-[10px]"
          >
            <ShieldCheck className="h-2.5 w-2.5" />
            ادمین
          </Badge>
        )}
      </button>
    );
  }

  // ------------------------- کارت کاربر (مشترک) -------------------------
  const userCard = (
    <div className="rounded-xl border bg-muted/40 p-2.5 text-xs space-y-1">
      <div className="flex items-center gap-2 font-medium">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
          {currentUser.displayName.trim().charAt(0) || "؟"}
        </span>
        <span className="truncate">{currentUser.displayName}</span>
        {isAdmin ? (
          <Badge variant="secondary" className="mr-auto h-4 px-1.5 text-[10px]">
            ادمین
          </Badge>
        ) : (
          <Badge variant="outline" className="mr-auto h-4 px-1.5 text-[10px]">
            {isBalanceOnly ? "فقط مانده" : "تراکنش‌ها"}
          </Badge>
        )}
      </div>
      <div className="text-muted-foreground truncate font-mono ps-9" dir="ltr">
        {currentUser.username}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-background">
      {/* ═══════════ سایدبار دسکتاپ (راست در RTL) ═══════════ */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-l bg-card transition-[width] duration-300 lg:flex",
          collapsed ? "w-[76px]" : "w-72"
        )}
        aria-label="منوی اصلی"
      >
        {/* لوگو */}
        <div
          className={cn(
            "flex h-16 items-center gap-2.5 border-b px-4",
            collapsed && "justify-center px-0"
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl brand-gradient text-white shadow-fab">
            <BookOpenText className="h-5 w-5" />
          </span>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-base font-extrabold leading-6">
                دفتر حساب کتاب ({currentUser.displayName})
              </span>
              <span className="text-[10px] text-muted-foreground">
                بدهی و طلب با تقویم شمسی
              </span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="mr-auto h-8 w-8 text-muted-foreground"
              onClick={() => setCollapsed(true)}
              aria-label="جمع‌کردن منو"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto mt-2 h-8 w-8 text-muted-foreground"
            onClick={() => setCollapsed(false)}
            aria-label="بازکردن منو"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        )}

        {/* آیتم‌های منو */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-persian">
          {visibleNavItems.map((item) => (
            <NavButton key={item.value} item={item} compact={collapsed} />
          ))}
        </nav>

        {/* پایین سایدبار: کاربر + تم + خروج */}
        <div className="space-y-2 border-t p-3">
          {!collapsed && userCard}
          <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "relative justify-center",
                collapsed ? "h-9 w-9 p-0" : "flex-1"
              )}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="تغییر تم"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              {!collapsed && (theme === "dark" ? "روشن" : "تاریک")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              aria-label="خروج"
              className={cn(
                "text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30",
                collapsed ? "h-9 w-9 p-0" : "flex-1"
              )}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && "خروج"}
            </Button>
          </div>
        </div>
      </aside>

      {/* ═══════════ ستون اصلی ═══════════ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* نوار بالا */}
        <header className="glass sticky top-0 z-40 border-b">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
            {/* همبرگر موبایل — سمت راست (اول در RTL) */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 lg:hidden"
                  aria-label="باز کردن منو"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0 flex flex-col">
                <SheetHeader className="border-b p-4">
                  <SheetTitle className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl brand-gradient text-white shadow-fab">
                      <BookOpenText className="h-5 w-5" />
                    </span>
                    <span className="truncate text-base font-extrabold">
                      دفتر حساب کتاب ({currentUser.displayName})
                    </span>
                  </SheetTitle>
                </SheetHeader>

                <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-persian">
                  {visibleNavItems.map((item) => (
                    <NavButton key={item.value} item={item} />
                  ))}
                </nav>

                {/* بخش پایین: کاربر + تم + خروج */}
                <div className="mt-auto space-y-2 border-t p-3">
                  {userCard}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="relative flex-1 justify-center"
                      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                      aria-label="تغییر تم"
                    >
                      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                      {theme === "dark" ? "روشن" : "تاریک"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      aria-label="خروج"
                      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/30"
                    >
                      <LogOut className="h-4 w-4" />
                      خروج
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {/* لوگو موبایل */}
            <div className="flex min-w-0 items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-gradient text-white">
                <BookOpenText className="h-4 w-4" />
              </span>
              <span className="truncate text-base font-extrabold">
                دفتر حساب کتاب ({currentUser.displayName})
              </span>
            </div>

            {/* عنوان صفحه + تاریخ — دسکتاپ */}
            <div className="hidden min-w-0 items-center gap-3 lg:flex">
              <h1 className="truncate text-base font-bold">{TAB_TITLES[finalTab]}</h1>
              <span className="h-4 w-px bg-border" aria-hidden />
              <span className="truncate text-xs text-muted-foreground">
                {currentUser.displayName}
              </span>
            </div>

            <div className="mr-auto flex items-center gap-1.5">
              {/* حالت واقعی/نمایشی */}
              {!realMode && (
                <Badge variant="outline" className="hidden h-5 px-2 text-[10px] sm:inline-flex">
                  حالت نمایشی
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 lg:hidden"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="تغییر تم"
              >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 -rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
              {/* آواتار کاربر موبایل */}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary lg:hidden">
                {currentUser.displayName.trim().charAt(0) || "؟"}
              </span>
            </div>
          </div>
        </header>

        {/* محتوای اصلی */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
          {activeContent}
        </main>

        {/* منوی پایین موبایل — sticky (هرگز فوتر را نمی‌پوشاند) */}
        <nav
          className={cn(
            "glass sticky bottom-0 z-50 border-t lg:hidden",
            !isBalanceOnly && "pb-0"
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="منوی دسترسی سریع"
        >
          {isBalanceOnly ? (
            <div className="mx-auto grid max-w-6xl grid-cols-3">
              <MobileTabButton
                icon={LayoutDashboard}
                label="داشبورد"
                active={finalTab === "dashboard"}
                onClick={() => selectTab("dashboard")}
              />
              <MobileTabButton
                icon={Send}
                label="تلگرام"
                active={finalTab === "telegram"}
                onClick={() => selectTab("telegram")}
              />
              <MobileTabButton
                icon={Settings}
                label="تنظیمات"
                active={finalTab === "personal"}
                onClick={() => selectTab("personal")}
              />
            </div>
          ) : (
            <div className="mx-auto grid max-w-6xl grid-cols-5 items-end">
              <MobileTabButton
                icon={Home}
                label="داشبورد"
                active={finalTab === "dashboard"}
                onClick={() => selectTab("dashboard")}
              />
              <MobileTabButton
                icon={ListIcon}
                label="تراکنش‌ها"
                active={finalTab === "transactions"}
                onClick={() => selectTab("transactions")}
              />
              {/* دکمه شناور ثبت تراکنش */}
              <div className="relative flex justify-center" style={{ height: 56 }}>
                <button
                  type="button"
                  onClick={() => setTxDialogOpen(true)}
                  className="absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full border-4 border-background brand-gradient text-white shadow-fab transition-transform active:scale-95"
                  aria-label="افزودن تراکنش جدید"
                >
                  <PlusCircle className="h-6 w-6" />
                </button>
              </div>
              <MobileTabButton
                icon={Send}
                label="تلگرام"
                active={finalTab === "telegram"}
                onClick={() => selectTab("telegram")}
              />
              <MobileTabButton
                icon={Settings}
                label="تنظیمات"
                active={finalTab === "personal"}
                onClick={() => selectTab("personal")}
              />
            </div>
          )}
        </nav>

        {/* دیالوگ افزودن تراکنش */}
        {!isBalanceOnly && (
          <TransactionFormDialog open={txDialogOpen} onOpenChange={setTxDialogOpen} />
        )}

        {/* فوتر — با mt-auto همیشه کف صفحه، بدون پوشاندن محتوا */}
        <footer className="mt-auto border-t bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <div className="flex items-center gap-1.5">
              <BookOpenText className="h-3.5 w-3.5 text-primary" />
              <span>
                دفتر حساب کتاب — نسخه {toPersianDigits(APP_VERSION)} (دفتر مستقل + دید
                دوجانبه)
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span>کامنت‌های دوطرفه</span>
              <span aria-hidden>•</span>
              <span>دسته‌بندی شخصی</span>
              <span aria-hidden>•</span>
              <span>تقویم شمسی</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// دکمه منوی پایین موبایل
// ---------------------------------------------------------------------------

function MobileTabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 py-2.5 transition-colors",
        active ? "text-primary" : "text-muted-foreground hover:text-primary"
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("h-5 w-5", active && "drop-shadow-sm")} />
      <span className={cn("text-[10px]", active && "font-bold")}>{label}</span>
      <span
        className={cn(
          "h-1 w-1 rounded-full transition-colors",
          active ? "bg-primary" : "bg-transparent"
        )}
        aria-hidden
      />
    </button>
  );
}

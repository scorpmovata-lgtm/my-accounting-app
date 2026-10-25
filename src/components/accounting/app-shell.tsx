"use client";

import { useEffect, useState } from "react";
import {
  BookOpenText,
  Moon,
  Sun,
  LogOut,
  Cloud,
  Loader2,
  Menu,
  LayoutDashboard,
  Receipt,
  Tags,
  CloudCog,
  Settings,
  FileText,
  Rocket,
  ShieldCheck,
  Send,
  User as UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

type TabValue =
  | "connect"
  | "dashboard"
  | "transactions"
  | "categories"
  | "telegram"
  | "admin"
  | "audit"
  | "setup";

interface NavItem {
  value: TabValue;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const ALL_NAV_ITEMS: NavItem[] = [
  { value: "connect", label: "اتصال", icon: CloudCog },
  { value: "dashboard", label: "داشبورد", icon: LayoutDashboard },
  { value: "transactions", label: "تراکنش‌ها", icon: Receipt },
  { value: "categories", label: "سرفصل‌ها", icon: Tags },
  { value: "setup", label: "راه‌اندازی", icon: Rocket },
  { value: "telegram", label: "تلگرام", icon: Send, adminOnly: true },
  { value: "admin", label: "مدیریت", icon: Settings, adminOnly: true },
  { value: "audit", label: "ممیزی", icon: FileText, adminOnly: true },
];

export function AppShell() {
  const authStatus = useAuthStore((s) => s.status);
  const authUser = useAuthStore((s) => s.user);
  const init = useAuthStore((s) => s.init);
  const logout = useAuthStore((s) => s.logout);

  const ledger = useAccountingStore((s) => s.ledger);
  const realMode = useAccountingStore((s) => s.realMode);
  const activateRealMode = useAccountingStore((s) => s.activateRealMode);
  const deactivateRealMode = useAccountingStore((s) => s.deactivateRealMode);

  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);

  // init احراز هویت — فقط در mount
  useEffect(() => {
    const unsubscribe = init();
    return () => {
      unsubscribe();
    };
  }, [init]);

  // فعال‌سازی real mode هنگام login موفق (در AppShell که همیشه رندر می‌شود)
  // این منطق قبلاً در ConnectTab بود ولی چون ConnectTab فقط وقتی تب فعال است
  // رندر می‌شود، بعد از refresh روی تب دیگر، realMode فعال نمی‌شد.
  useEffect(() => {
    if (authStatus === "authenticated" && authUser?.ledgerId && !realMode) {
      void activateRealMode(
        authUser.ledgerId,
        authUser.displayName ?? authUser.email ?? "کاربر"
      );
    } else if (authStatus === "anonymous" && realMode) {
      deactivateRealMode();
    }
  }, [authStatus, authUser, realMode, activateRealMode, deactivateRealMode]);

  const isLoggedIn = authStatus === "authenticated" && !!authUser;
  const isAdmin = isLoggedIn && !!authUser?.isAdmin;

  // محاسبه تب قابل نمایش:
  // ۱. اگر کاربر وارد نشده و روی تب غیر از setup/connect است → connect
  // ۲. اگر تب فعلی admin-only است و کاربر admin نیست → connect
  function computeFinalTab(desired: string): TabValue {
    const adminOnly: TabValue[] = ["telegram", "admin", "audit"];
    if (!isLoggedIn && desired !== "setup" && desired !== "connect") {
      return "connect";
    }
    if (adminOnly.includes(desired as TabValue) && !isAdmin) {
      return "connect";
    }
    return desired as TabValue;
  }

  const finalTab = computeFinalTab(tab);

  function selectTab(value: TabValue) {
    setTab(value);
    setMenuOpen(false);
  }

  async function handleLogout() {
    await logout();
    toast({
      title: "خروج انجام شد",
      description: "نشست شما بسته شد.",
    });
    setTab("connect");
    setMenuOpen(false);
  }

  const visibleNavItems = ALL_NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  // محتوای تب فعال
  let activeContent: React.ReactNode = null;
  switch (finalTab) {
    case "connect":
      activeContent = <ConnectTab />;
      break;
    case "dashboard":
      activeContent = <DashboardPanel />;
      break;
    case "transactions":
      activeContent = (
        <div className="space-y-4">
          {isLoggedIn ? (
            <div className="flex justify-end">
              <TransactionFormDialog />
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
              برای ثبت تراکنش ابتدا از منو «اتصال» را باز کرده و وارد شوید.
            </div>
          )}
          <TransactionsTable />
        </div>
      );
      break;
    case "categories":
      activeContent = <CategoriesPanel />;
      break;
    case "setup":
      activeContent = <SetupTab />;
      break;
    case "telegram":
      activeContent = <TelegramLinkPanel />;
      break;
    case "admin":
      activeContent = <AdminTab />;
      break;
    case "audit":
      activeContent = <AuditLogPanel />;
      break;
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

  // هدر: نمایش نام کاربر واقعی هنگام ورود، نام موک هنگام میهمان
  const headerSubtitle = isLoggedIn ? (
    <span className="inline-flex items-center gap-1.5">
      کاربر: {authUser?.displayName ?? authUser?.email ?? "نامشخص"}
      {isAdmin && (
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 h-4 px-1.5 text-[10px]"
        >
          ادمین
        </Badge>
      )}
    </span>
  ) : (
    <span>صاحب دفتر (موک): {ledger.ownerName}</span>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpenText className="h-6 w-6 text-primary shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold leading-tight truncate">
                {isLoggedIn
                  ? (authUser?.displayName ?? authUser?.email ?? "—")
                  : ledger.name}
              </span>
              <span className="text-xs text-muted-foreground leading-tight truncate">
                {headerSubtitle}
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

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                aria-label="باز کردن منو"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 p-0 flex flex-col"
            >
              <SheetHeader className="p-4 border-b">
                <SheetTitle className="flex items-center gap-2">
                  <BookOpenText className="h-5 w-5 text-primary" />
                  منوی اصلی
                </SheetTitle>
              </SheetHeader>

              {/* فهرست ناوبری */}
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

              {/* بخش پایین: کاربر + تم */}
              <div className="border-t p-3 space-y-2 mt-auto">
                {isLoggedIn && authUser ? (
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-medium">
                      <UserIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {authUser.displayName ?? "کاربر"}
                      </span>
                      {isAdmin && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px] mr-auto"
                        >
                          ادمین
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate" dir="ltr">
                      {authUser.email ?? "—"}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground">
                    به‌عنوان میهمان مشاهده می‌کنید. برای دسترسی کامل وارد
                    شوید.
                  </div>
                )}

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
                  {isLoggedIn && (
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
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4 sm:py-6">
        {activeContent}
      </main>

      <footer className="border-t bg-card/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>دفتر حسابداری — نسخه {toPersianDigits("1.3")}</div>
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

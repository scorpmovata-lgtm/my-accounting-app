"use client";

import { useState } from "react";
import { BookOpenText, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAccountingStore } from "@/store/accounting-store";
import { DashboardPanel } from "./dashboard-panel";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { CategoriesPanel } from "./categories-panel";
import { TelegramLinkPanel } from "./telegram-link-panel";
import { AuditLogPanel } from "./audit-log-panel";
import { SetupTab } from "./setup-tab";
import { toPersianDigits } from "@/lib/accounting/jalali";

export function AppShell() {
  const ledger = useAccountingStore((s) => s.ledger);
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState("dashboard");

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
                صاحب دفتر: {ledger.ownerName}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9"
              onClick={() =>
                setTheme(theme === "dark" ? "light" : "dark")
              }
              aria-label="تغییر تم"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-2 sm:grid-cols-6 mb-4 w-full">
            <TabsTrigger value="dashboard">داشبورد</TabsTrigger>
            <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
            <TabsTrigger value="categories">سرفصل‌ها</TabsTrigger>
            <TabsTrigger value="telegram">تلگرام</TabsTrigger>
            <TabsTrigger value="audit">ممیزی</TabsTrigger>
            <TabsTrigger value="setup">راه‌اندازی</TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard" className="mt-0 focus-visible:outline-none">
            <DashboardPanel />
          </TabsContent>
          <TabsContent value="transactions" className="mt-0 focus-visible:outline-none">
            <div className="space-y-4">
              <div className="flex justify-end">
                <TransactionFormDialog />
              </div>
              <TransactionsTable />
            </div>
          </TabsContent>
          <TabsContent value="categories" className="mt-0 focus-visible:outline-none">
            <CategoriesPanel />
          </TabsContent>
          <TabsContent value="telegram" className="mt-0 focus-visible:outline-none">
            <TelegramLinkPanel />
          </TabsContent>
          <TabsContent value="audit" className="mt-0 focus-visible:outline-none">
            <AuditLogPanel />
          </TabsContent>
          <TabsContent value="setup" className="mt-0 focus-visible:outline-none">
            <SetupTab />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            دفتر حسابداری — نسخه {toPersianDigits("0.1")} پروتوتایپ
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span>ساخته‌شده با Next.js</span>
            <span aria-hidden>•</span>
            <span>مطابق سند طراحی «مرحله صفر»</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

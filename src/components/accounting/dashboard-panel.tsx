"use client";

// داشبورد «دفتر حساب کتاب» — چیدمان Premium Fintech
// ---------------------------------------------------------------
// ۱) کارت‌های خلاصه مالی (قهرمان گرادیانی + طلب/بدهی با اسپارک‌لاین)
// ۲) نمودار روند تراکنش‌ها با فیلتر بازه زمانی
// ۳) مانده طرف‌حساب‌ها (فول‌عرض — فهرست بلندتر)
// ۴) گزارش‌های تحلیلی کنار هم: «وضعیت کلی» + «جمع‌بندی دسته‌بندی‌ها»
// ۵) وضعیت تراکنش‌های من در حساب دیگران (دید دوجانبه)

import { BalanceCards } from "./balance-cards";
import { ContactBalancesList } from "./contact-balances-list";
import { CategoryBreakdown } from "./category-breakdown";
import { OthersLedgerSection } from "./others-ledger-section";
import { TrendChartCard } from "./ui/trend-chart-card";
import { OverallStatusCard } from "./ui/overall-status-card";

export function DashboardPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceCards />
      <TrendChartCard />
      <ContactBalancesList />
      {/* دو کارت تحلیلی کنار هم در دسکتاپ: وضعیت کلی + تفکیک دسته */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
        <OverallStatusCard />
        <CategoryBreakdown />
      </div>
      <OthersLedgerSection />
    </div>
  );
}

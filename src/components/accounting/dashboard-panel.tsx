"use client";

import { BalanceCards } from "./balance-cards";
import { ContactBalancesList } from "./contact-balances-list";
import { CategoryBreakdown } from "./category-breakdown";
import { OthersLedgerSection } from "./others-ledger-section";

export function DashboardPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceCards />
      <ContactBalancesList />
      <CategoryBreakdown />
      <OthersLedgerSection />
    </div>
  );
}

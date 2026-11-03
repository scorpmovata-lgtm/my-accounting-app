"use client";

import { BalanceCards } from "./balance-cards";
import { ContactBalancesList } from "./contact-balances-list";

export function DashboardPanel() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <BalanceCards />
      <ContactBalancesList />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { BalanceCards } from "./balance-cards";
import { ContactBalancesList } from "./contact-balances-list";
import { TransactionsTable } from "./transactions-table";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { useAccountingStore } from "@/store/accounting-store";
import { computeLedgerBalance } from "@/lib/accounting/engine";

export function DashboardPanel() {
  const transactions = useAccountingStore((s) => s.transactions);
  const contacts = useAccountingStore((s) => s.contacts);
  const [selectedContact, setSelectedContact] = useState<string | null>(
    null
  );

  const balance = useMemo(
    () => computeLedgerBalance(transactions),
    [transactions]
  );

  return (
    <div className="space-y-4">
      <BalanceCards balance={balance} />
      <div className="flex justify-end">
        <TransactionFormDialog />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ContactBalancesList
          contacts={contacts}
          balances={balance.byContact}
          onSelectContact={(id) =>
            setSelectedContact((cur) => (cur === id ? null : id))
          }
          selectedContactId={selectedContact}
        />
        <TransactionsTable
          filterContactId={selectedContact}
          onClearContactFilter={() => setSelectedContact(null)}
        />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { Screen } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

import BalanceCard from "../../_components/BalanceCard";
import SendSheet from "../../_components/SendSheet";
import TxRow from "../../_components/TxRow";
import { BALANCE, TRANSACTIONS } from "../../_data/wallet";

function WalletHomeScreen() {
  const dict = useShellDict();
  const [sheetOpen, setSheetOpen] = useState(false);
  const recent = TRANSACTIONS.slice(0, 4);

  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="var(--color-bg)">
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pb-4">
          <header className="px-5 pt-5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
              flemo pay
            </h1>
          </header>
          <BalanceCard balance={BALANCE} onSend={() => setSheetOpen(true)} />
          <section className="mt-5">
            <h2 className="px-5 pb-1 text-sm font-semibold text-[var(--color-text-secondary)]">
              {dict.wallet.recent}
            </h2>
            {recent.map((tx) => (
              <TxRow key={tx.id} tx={tx} />
            ))}
          </section>
        </div>
      </div>
      {sheetOpen && <SendSheet onClose={() => setSheetOpen(false)} />}
    </Screen>
  );
}

export default WalletHomeScreen;

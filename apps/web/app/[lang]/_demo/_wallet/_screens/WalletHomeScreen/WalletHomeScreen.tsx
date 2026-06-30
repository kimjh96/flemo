"use client";

import { useNavigate } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import BalanceCard from "../../_components/BalanceCard";
import TxRow from "../../_components/TxRow";
import WalletScreen from "../../_components/WalletScreen";
import WalletTabBar from "../../_components/WalletTabBar";
import { BALANCE, TRANSACTIONS } from "../../_data/wallet";

// Home declares the shared navigation bar (the tab bar). Activity declares the
// same bar, so flemo keeps it pinned across the home <-> activity shared-axis
// move. Pushing the detail or the send screen (neither declares it) animates
// the bar away, the shared-bar present/absent transition.
function WalletHomeScreen() {
  const dict = useShellDict();
  const navigate = useNavigate();
  const recent = TRANSACTIONS.slice(0, 4);

  return (
    <WalletScreen sharedBottomBar={<WalletTabBar />}>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto pb-20">
          <header className="px-5 pt-5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
              flemo pay
            </h1>
          </header>
          <BalanceCard
            balance={BALANCE}
            onSend={() => navigate.push("/wallet/send", {}, { transitionName: "material" })}
          />
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
    </WalletScreen>
  );
}

export default WalletHomeScreen;

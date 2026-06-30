"use client";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import TxRow from "../../_components/TxRow";
import WalletScreen from "../../_components/WalletScreen";
import WalletTabBar from "../../_components/WalletTabBar";
import { TRANSACTIONS } from "../../_data/wallet";

const GROUPS = [
  { day: "today", items: TRANSACTIONS.filter((tx) => tx.day === "today") },
  { day: "yesterday", items: TRANSACTIONS.filter((tx) => tx.day === "yesterday") }
] as const;

// Declares the same shared navigation bar as Home, so it stays pinned across
// the home <-> activity shared-axis move.
function WalletActivityScreen() {
  const dict = useShellDict();

  return (
    <WalletScreen sharedBottomBar={<WalletTabBar />}>
      <div className="flex h-full flex-col">
        <header className="px-5 pt-5 pb-1">
          <h1 className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">
            {dict.wallet.tab.activity}
          </h1>
        </header>
        <div className="flex-1 overflow-y-auto pb-20">
          {GROUPS.map((group) => (
            <section key={group.day}>
              <h2 className="px-5 pt-3 pb-1 text-xs font-semibold text-[var(--color-text-disabled)]">
                {dict.wallet.day[group.day]}
              </h2>
              {group.items.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </WalletScreen>
  );
}

export default WalletActivityScreen;

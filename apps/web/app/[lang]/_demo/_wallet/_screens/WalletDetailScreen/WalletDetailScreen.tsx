"use client";

import { useNavigate, useParams } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import WalletScreen from "../../_components/WalletScreen";
import { formatWon, txById } from "../../_data/wallet";

// No shared bar: pushing here (cupertino) animates the tab bar away, and popping
// brings it back, the shared-bar present/absent transition.

function WalletDetailScreen() {
  const dict = useShellDict();
  const navigate = useNavigate();
  const params = useParams<"/wallet/tx/:id">();
  const tx = txById(params?.id ?? "");
  const positive = (tx?.amount ?? 0) > 0;

  const handleBack = () => navigate.pop();

  const rows = tx
    ? [
        {
          label: dict.wallet.tab.activity,
          value: positive ? dict.wallet.detail.received : dict.wallet.detail.spent
        },
        { label: dict.wallet.day[tx.day], value: tx.time }
      ]
    : [];

  return (
    <WalletScreen>
      <div className="flex h-full flex-col">
        <header className="flex items-center px-3 pt-4">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </header>
        {tx && (
          <div className="flex flex-1 flex-col items-center px-6 pt-6">
            <span className="grid size-16 place-items-center rounded-full bg-[var(--color-layer)] text-3xl">
              {tx.emoji}
            </span>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{tx.merchant}</p>
            <p
              className={`mt-1 text-[32px] font-bold tracking-tight ${
                positive ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"
              }`}
            >
              {formatWon(tx.amount)}
            </p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success)]/10 px-3 py-1 text-xs font-semibold text-[var(--color-success)]">
              <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
              {dict.wallet.detail.status}
            </span>
            <dl className="mt-7 w-full divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
              {rows.map((row, index) => (
                <div key={index} className="flex items-center justify-between px-4 py-3">
                  <dt className="text-sm text-[var(--color-text-secondary)]">{row.label}</dt>
                  <dd className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </WalletScreen>
  );
}

export default WalletDetailScreen;

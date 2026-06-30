"use client";

import { useNavigate } from "@flemo/react";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

import WalletScreen from "../../_components/WalletScreen";

// Pushed with the material transition (a vertical rise), and declares no shared
// bar, a third transition kind, and another barless page, to round out the
// showcase.
function WalletSendScreen() {
  const dict = useShellDict();
  const navigate = useNavigate();

  const handleClose = () => navigate.pop();

  const rows = [
    { label: dict.wallet.sheet.amountLabel, value: "₩50,000" },
    { label: dict.wallet.sheet.toLabel, value: dict.wallet.sheet.toValue }
  ];

  return (
    <WalletScreen>
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {dict.wallet.sheet.title}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="grid size-9 cursor-pointer place-items-center rounded-full text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-layer)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div className="flex-1 px-5 pt-7">
          <dl className="divide-y divide-[var(--color-border)] rounded-2xl border border-[var(--color-border)]">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3.5">
                <dt className="text-sm text-[var(--color-text-secondary)]">{row.label}</dt>
                <dd className="text-sm font-bold text-[var(--color-text-primary)]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="p-5">
          <button
            type="button"
            onClick={handleClose}
            className="w-full cursor-pointer rounded-2xl bg-[var(--color-primary)] py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            {dict.wallet.sheet.confirm}
          </button>
        </div>
      </div>
    </WalletScreen>
  );
}

export default WalletSendScreen;

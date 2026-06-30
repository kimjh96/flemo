"use client";

import { useShellDict } from "@/app/[lang]/_providers/ShellIntlProvider";

export interface BalanceCardProps {
  balance: number;
  onSend: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  send: "M7 17 17 7M9 7h8v8",
  request: "M17 7 7 17M15 17H7V9",
  topup: "M12 5v14M5 12h14"
};

const SPARKLINE = "M0 26 L14 20 L28 23 L42 12 L56 16 L70 6 L84 10";

// A clean modern balance card: a light surface (not a heavy gradient block), a
// bold dark number, a green trend chip, an accent sparkline, and subtle icon
// quick-actions with the primary Send.
function BalanceCard({ balance, onSend }: BalanceCardProps) {
  const dict = useShellDict();

  const actions = [
    { key: "send", label: dict.wallet.actions.send, onClick: onSend, primary: true },
    { key: "request", label: dict.wallet.actions.request, primary: false },
    { key: "topup", label: dict.wallet.actions.topup, primary: false }
  ];

  return (
    <div className="mx-4 mt-3 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_12px_32px_-20px_rgba(15,19,27,0.3)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            {dict.wallet.balanceLabel}
          </p>
          <p className="mt-1 text-[30px] leading-none font-bold tracking-tight text-[var(--color-text-primary)]">
            ₩{balance.toLocaleString("ko-KR")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--color-success)]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M5 15l7-7 7 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          2.4%
        </span>
      </div>
      <svg
        viewBox="0 0 84 32"
        preserveAspectRatio="none"
        className="mt-3 h-9 w-full"
        fill="none"
        aria-hidden="true"
      >
        <path
          d={SPARKLINE}
          stroke="var(--color-primary)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-4 flex gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className={`flex flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-2xl py-2.5 text-[11px] font-semibold transition-colors ${
              action.primary
                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
                : "bg-[var(--color-layer)] text-[var(--color-text-primary)] hover:bg-[var(--color-neutral-200)]"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d={ACTION_ICONS[action.key]}
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default BalanceCard;

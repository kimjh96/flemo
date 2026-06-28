"use client";

import { useShellDict } from "@/app/[lang]/(app)/_providers/ShellIntlProvider";

export interface BalanceCardProps {
  balance: number;
  onSend: () => void;
}

// The balance hero card. The Send action opens the <Layer> bottom sheet; the
// other two are decorative for the demo.
function BalanceCard({ balance, onSend }: BalanceCardProps) {
  const dict = useShellDict();

  const actions = [
    { key: "send", label: dict.wallet.actions.send, onClick: onSend },
    { key: "request", label: dict.wallet.actions.request },
    { key: "topup", label: dict.wallet.actions.topup }
  ];

  return (
    <div
      className="mx-4 mt-3 rounded-3xl p-5 text-white shadow-[0_16px_36px_-20px_rgba(0,102,204,0.7)]"
      style={{ background: "var(--gradient-primary-accent)" }}
    >
      <p className="text-xs font-medium opacity-80">{dict.wallet.balanceLabel}</p>
      <p className="mt-1 text-[28px] font-bold tracking-tight">
        ₩{balance.toLocaleString("ko-KR")}
      </p>
      <div className="mt-4 flex gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="flex-1 cursor-pointer rounded-xl bg-white/15 py-2 text-xs font-semibold backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default BalanceCard;

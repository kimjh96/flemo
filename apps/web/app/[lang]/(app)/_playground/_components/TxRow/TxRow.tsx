"use client";

import { useNavigate } from "@flemo/react";

import { formatWon, type Tx } from "../../_data/wallet";

export interface TxRowProps {
  tx: Tx;
}

// A transaction row. Tapping pushes the detail screen (cupertino, with
// swipe-back). Reused by both Home and Activity.
function TxRow({ tx }: TxRowProps) {
  const navigate = useNavigate();
  const positive = tx.amount > 0;

  return (
    <button
      type="button"
      onClick={() => navigate.push("/wallet/tx/:id", { id: tx.id })}
      className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-[var(--color-layer)]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--color-layer)] text-lg">
        {tx.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {tx.merchant}
        </span>
        <span className="block text-xs text-[var(--color-text-disabled)]">{tx.time}</span>
      </span>
      <span
        className={`shrink-0 text-sm font-bold ${
          positive ? "text-[var(--color-success)]" : "text-[var(--color-text-primary)]"
        }`}
      >
        {formatWon(tx.amount)}
      </span>
    </button>
  );
}

export default TxRow;

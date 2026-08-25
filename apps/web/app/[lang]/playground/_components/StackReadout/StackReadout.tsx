"use client";

import { usePathname, useHistoryStore, useNavigateStore } from "@flemo/react";

// The Router's own state, read with the public hooks and rendered OUTSIDE the
// <Slot>.
//
// Two things at once, both of them things the fixture should be showing rather
// than describing. It is chrome that lives beside the stack instead of inside
// it, so it survives every navigation without being part of one. And it is
// `usePathname` / `useHistoryStore` / `useNavigateStore` doing what a consumer
// would use them for: the address, the status of the flight that is running,
// and how deep the stack is, live, while you drive it.
export interface StackReadoutProps {
  /** Which scope this is reading: there are two on screen at once. */
  label: string;
}

function StackReadout({ label }: StackReadoutProps) {
  const pathname = usePathname();
  const status = useNavigateStore((state) => state.status);
  const depth = useHistoryStore((state) => state.histories.length);
  const index = useHistoryStore((state) => state.index);

  return (
    <div className="flex items-center gap-2 border-t border-[var(--color-border-light)] bg-[var(--color-layer)] px-4 py-1.5 font-mono text-[11px]">
      <span className="text-[var(--color-primary)]">{label}</span>
      <span className="min-w-0 flex-1 truncate text-[var(--color-text-primary)]">{pathname}</span>
      <span
        className={
          status === "COMPLETED" || status === "IDLE"
            ? "text-[var(--color-text-disabled)]"
            : "text-[var(--color-primary)]"
        }
      >
        {status}
      </span>
      <span className="text-[var(--color-text-secondary)] tabular-nums">
        {index + 1}/{depth}
      </span>
    </div>
  );
}

export default StackReadout;

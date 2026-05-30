"use client";

import type { NavigateStatus } from "@flemo/core";

// Maps flemo's navigate status to a token-colored pill. The transient states
// (PUSHING/POPPING/REPLACING) read as "in motion" (primary); COMPLETED is a
// settled success; IDLE is neutral.
const statusColor: Record<NavigateStatus, string> = {
  IDLE: "var(--color-ink-mute)",
  PUSHING: "var(--color-primary)",
  POPPING: "var(--color-primary)",
  REPLACING: "var(--color-primary)",
  COMPLETED: "var(--color-success)"
};

export interface PlaygroundStatusBadgeProps {
  status: NavigateStatus;
}

function PlaygroundStatusBadge({ status }: PlaygroundStatusBadgeProps) {
  const color = statusColor[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em]"
      style={{ borderColor: color, color }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {status}
    </span>
  );
}

export default PlaygroundStatusBadge;

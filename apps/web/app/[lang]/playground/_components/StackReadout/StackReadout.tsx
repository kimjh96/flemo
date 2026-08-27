"use client";

import { useTelemetry } from "../../_providers/TelemetryContext";

export interface StackReadoutProps {
  /** Scopes in the order they should read, outermost first. */
  scopes: { id: string; label: string }[];
}

// The readout, drawn UNDER the stage frame rather than inside the phone.
//
// One row per live scope, outermost first, so a nested push is legible as the
// thing it is: the inner row's depth climbs while the outer row holds at 1/1.
// A scope that is not mounted has no row at all, rather than a row of dashes —
// there is nothing to report about a Router that does not exist, and a dashed
// row invites reading it as a stack of depth zero.
function StackReadout({ scopes }: StackReadoutProps) {
  const { readings } = useTelemetry();
  const live = scopes.filter((scope) => readings[scope.id]);

  if (live.length === 0) return null;

  return (
    <dl className="mt-4 w-full overflow-hidden rounded-xl border border-[var(--color-border-light)] bg-[var(--color-layer)] font-mono text-[11px]">
      {live.map((scope, position) => {
        const reading = readings[scope.id]!;
        const settled = reading.status === "IDLE" || reading.status === "COMPLETED";

        return (
          <div
            key={scope.id}
            className={`flex items-center gap-3 px-3 py-1.5 ${
              position > 0 ? "border-t border-[var(--color-border-light)]" : ""
            }`}
          >
            <dt className="w-14 shrink-0 text-[var(--color-primary)]">{scope.label}</dt>
            <dd className="m-0 min-w-0 flex-1 truncate text-[var(--color-text-primary)]">
              {reading.path}
            </dd>
            <dd
              className={`m-0 shrink-0 ${
                settled ? "text-[var(--color-text-disabled)]" : "text-[var(--color-primary)]"
              }`}
            >
              {reading.status}
            </dd>
            <dd className="m-0 shrink-0 tabular-nums text-[var(--color-text-secondary)]">
              {reading.index + 1}/{reading.depth}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default StackReadout;

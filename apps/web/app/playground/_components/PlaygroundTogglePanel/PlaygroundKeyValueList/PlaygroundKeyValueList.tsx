"use client";

import type { ReactNode } from "react";

// A semantic key/value read-out used by the live inspector and the shared-bar
// presence table. Each row is a term + its value; `highlight` marks the
// active/current row.
export interface KeyValueRow {
  key: string;
  term: ReactNode;
  value: ReactNode;
  highlight?: boolean;
}

export interface PlaygroundKeyValueListProps {
  rows: ReadonlyArray<KeyValueRow>;
  empty?: string;
}

function PlaygroundKeyValueList({ rows, empty = "—" }: PlaygroundKeyValueListProps) {
  if (rows.length === 0) {
    return <p className="text-[12px] text-[var(--color-ink-mute)]">{empty}</p>;
  }

  return (
    <dl className="flex flex-col gap-1">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center justify-between gap-3 rounded-md px-2 py-1"
          style={{
            backgroundColor: row.highlight ? "var(--color-layer)" : "transparent"
          }}
        >
          <dt className="min-w-0 truncate font-mono text-[12px] text-[var(--color-text-primary)]">
            {row.term}
          </dt>
          <dd className="shrink-0 font-mono text-[12px] text-[var(--color-ink-soft)]">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default PlaygroundKeyValueList;

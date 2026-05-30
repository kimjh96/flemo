"use client";

// `@flemo/core` is imported here purely to READ flemo's runtime stores for a
// live inspector — the playground never mutates them directly (it drives
// navigation through `useNavigate`). This is inside the sanctioned playground
// tree, so reaching into core for inspection is fine.
import { useHistoryStore, useNavigateStore } from "@flemo/core";
import { useScreenStore } from "@flemo/react";

import PlaygroundKeyValueList, { type KeyValueRow } from "./PlaygroundKeyValueList";
import PlaygroundStatusBadge from "./PlaygroundStatusBadge";
import PlaygroundToggleCard from "./PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "./PlaygroundToggleCardHeader";
import { buildPresenceRows } from "./PlaygroundTogglePanel.presence";

const mark = (on: boolean) => (on ? "✓" : "✗");

function PlaygroundInspectorCard() {
  const histories = useHistoryStore((state) => state.histories);
  const index = useHistoryStore((state) => state.index);
  const status = useNavigateStore((state) => state.status);
  const sharedBars = useScreenStore((state) => state.sharedBars);

  // Top of the stack first, so the active screen reads at the top.
  const stackRows: KeyValueRow[] = histories
    .map((history, depth) => ({ history, depth }))
    .reverse()
    .map(({ history, depth }) => ({
      key: history.id,
      term: `${depth}  ${history.pathname}`,
      value: history.transitionName,
      highlight: depth === index
    }));

  const presenceRows: KeyValueRow[] = buildPresenceRows(histories, sharedBars).map((row) => ({
    key: row.id,
    term: row.pathname,
    value: `appBar ${mark(row.appBar)}  navBar ${mark(row.navigationBar)}`
  }));

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="Live inspector"
        title="What flemo is doing, right now"
        description="A read-only window into flemo's stores — the history stack, the navigation status as it moves through its state machine, and which mounted screens registered which shared bars. Navigate the preview and watch it update live."
      />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Status
        </span>
        <PlaygroundStatusBadge status={status} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          History stack (top first)
        </span>
        <PlaygroundKeyValueList rows={stackRows} empty="Empty stack." />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Shared bars by screen
        </span>
        <PlaygroundKeyValueList rows={presenceRows} empty="No screen mounted yet." />
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundInspectorCard;

"use client";

import { useHistoryStore } from "@flemo/core";
import { useScreenStore } from "@flemo/react";

import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundKeyValueList, { type KeyValueRow } from "./PlaygroundKeyValueList";
import PlaygroundToggleCard from "./PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "./PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "./PlaygroundToggleSwitch";
import { buildPresenceRows } from "./PlaygroundTogglePanel.presence";

const mark = (on: boolean) => (on ? "✓" : "✗");

function PlaygroundSharedBarsCard() {
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const showSharedAppBar = usePlaygroundSettingsStore((state) => state.showSharedAppBar);
  const setShowMiniPlayer = usePlaygroundSettingsStore((state) => state.setShowMiniPlayer);
  const setShowSharedAppBar = usePlaygroundSettingsStore((state) => state.setShowSharedAppBar);

  const histories = useHistoryStore((state) => state.histories);
  const sharedBars = useScreenStore((state) => state.sharedBars);

  const presenceRows: KeyValueRow[] = buildPresenceRows(histories, sharedBars).map((row) => ({
    key: row.id,
    term: row.pathname,
    value: `appBar ${mark(row.appBar)}  navBar ${mark(row.navigationBar)}`
  }));

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="sharedAppBar · sharedNavigationBar"
        title="Pin bars across screens"
        description="A shared bar stays mounted across pushes so it never re-animates. The nav bar (mini-player + tabs) spans Library, Search and Album; the app bar is shared only on Library. Toggle each, then watch the live presence below."
      />
      <div className="flex flex-col gap-2">
        <PlaygroundToggleSwitch
          name="Shared navigation bar"
          checked={showMiniPlayer}
          onChange={setShowMiniPlayer}
          on="Navigation bar · visible"
          off="Navigation bar · hidden"
        />
        <PlaygroundToggleSwitch
          name="Shared app bar"
          checked={showSharedAppBar}
          onChange={setShowSharedAppBar}
          on="App bar · visible"
          off="App bar · hidden"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          Mounted now
        </span>
        <PlaygroundKeyValueList rows={presenceRows} empty="No screen mounted yet." />
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundSharedBarsCard;

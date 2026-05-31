"use client";

import { useHistoryStore } from "@flemo/core";
import { useScreenStore } from "@flemo/react";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundKeyValueList, { type KeyValueRow } from "../PlaygroundKeyValueList";
import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "../PlaygroundToggleSwitch";
import { buildPresenceRows } from "../PlaygroundTogglePanel.presence";

const mark = (on: boolean) => (on ? "✓" : "✗");

function PlaygroundSharedBarsCard() {
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const showSharedAppBar = usePlaygroundSettingsStore((state) => state.showSharedAppBar);
  const setShowMiniPlayer = usePlaygroundSettingsStore((state) => state.setShowMiniPlayer);
  const setShowSharedAppBar = usePlaygroundSettingsStore((state) => state.setShowSharedAppBar);
  const t = usePlaygroundDict().devPanel.sharedBars;

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
        title={t.title}
        description={t.description}
      />
      <div className="flex flex-col gap-2">
        <PlaygroundToggleSwitch
          name={t.navName}
          checked={showMiniPlayer}
          onChange={setShowMiniPlayer}
          on={t.navOn}
          off={t.navOff}
        />
        <PlaygroundToggleSwitch
          name={t.appName}
          checked={showSharedAppBar}
          onChange={setShowSharedAppBar}
          on={t.appOn}
          off={t.appOff}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          {t.mountedNow}
        </span>
        <PlaygroundKeyValueList rows={presenceRows} empty={t.noScreen} />
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundSharedBarsCard;

"use client";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "../PlaygroundToggleSwitch";

function PlaygroundSharedBarsCard() {
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const showSharedAppBar = usePlaygroundSettingsStore((state) => state.showSharedAppBar);
  const setShowMiniPlayer = usePlaygroundSettingsStore((state) => state.setShowMiniPlayer);
  const setShowSharedAppBar = usePlaygroundSettingsStore((state) => state.setShowSharedAppBar);
  const t = usePlaygroundDict().devPanel.sharedBars;

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
    </PlaygroundToggleCard>
  );
}

export default PlaygroundSharedBarsCard;

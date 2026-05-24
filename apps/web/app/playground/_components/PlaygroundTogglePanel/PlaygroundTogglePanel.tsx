"use client";

import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundCodePeek from "./PlaygroundCodePeek";
import { transitionOptions } from "./PlaygroundTogglePanel.constants";
import PlaygroundToggleCard from "./PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "./PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "./PlaygroundToggleSwitch";
import PlaygroundTransitionPicker from "./PlaygroundTransitionPicker";

function PlaygroundTogglePanel() {
  const pushTransition = usePlaygroundSettingsStore((state) => state.pushTransition);
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const setPushTransition = usePlaygroundSettingsStore((state) => state.setPushTransition);
  const setShowMiniPlayer = usePlaygroundSettingsStore((state) => state.setShowMiniPlayer);

  const active =
    transitionOptions.find((option) => option.value === pushTransition) ?? transitionOptions[0]!;

  return (
    <section className="mx-auto flex w-full max-w-[560px] flex-col gap-5 text-[var(--color-text-primary)]">
      <PlaygroundToggleCard>
        <PlaygroundToggleCardHeader
          eyebrow="Library → Album"
          title="Pick the screen transition"
          description="Every entry below is a flemo Transition. Built-ins come from @flemo/core; custom ones live wherever you author them — no privileged registration."
        />
        <PlaygroundTransitionPicker
          options={transitionOptions}
          value={pushTransition}
          onChange={setPushTransition}
        />
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {active.summary}
        </p>
        <PlaygroundCodePeek code={active.code} />
      </PlaygroundToggleCard>

      <PlaygroundToggleCard>
        <PlaygroundToggleCardHeader
          eyebrow="sharedNavigationBar"
          title="Mini-player + tab bar"
          description="Pinned across Library, Search, and Album — flemo keeps it mounted so it never re-animates on push."
        />
        <PlaygroundToggleSwitch
          checked={showMiniPlayer}
          onChange={setShowMiniPlayer}
          on="Visible"
          off="Hidden"
        />
      </PlaygroundToggleCard>
    </section>
  );
}

export default PlaygroundTogglePanel;

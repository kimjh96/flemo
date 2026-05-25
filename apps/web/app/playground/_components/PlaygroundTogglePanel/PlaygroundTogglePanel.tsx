"use client";

import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundCodePeek from "./PlaygroundCodePeek";
import {
  naturalPushCode,
  transitionGroups,
  transitionOptions
} from "./PlaygroundTogglePanel.constants";
import PlaygroundToggleCard from "./PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "./PlaygroundToggleCardHeader";
import PlaygroundToggleSwitch from "./PlaygroundToggleSwitch";
import PlaygroundTransitionPicker from "./PlaygroundTransitionPicker";

function PlaygroundTogglePanel() {
  const pushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.pushTransitionOverride
  );
  const showMiniPlayer = usePlaygroundSettingsStore((state) => state.showMiniPlayer);
  const setPushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.setPushTransitionOverride
  );
  const setShowMiniPlayer = usePlaygroundSettingsStore((state) => state.setShowMiniPlayer);

  const active = transitionOptions.find((option) => option.value === pushTransitionOverride);

  return (
    <section className="mx-auto flex w-full max-w-[560px] flex-col gap-5 text-[var(--color-text-primary)]">
      <PlaygroundToggleCard>
        <PlaygroundToggleCardHeader
          eyebrow="Screen transition"
          title="Compose transitions per navigation"
          description="By default each push uses the transition that fits its affordance — cupertino for browse-deeper hops, material for the player. Pick a chip below to force every push to one transition for comparison; tap it again to drop back to the per-context defaults."
        />
        <PlaygroundTransitionPicker
          groups={transitionGroups}
          value={pushTransitionOverride}
          onChange={setPushTransitionOverride}
        />
        <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
          {active
            ? `Override active — ${active.summary}`
            : "No override — each push site picks its own transition inline."}
        </p>
        <PlaygroundCodePeek code={active ? active.code : naturalPushCode} />
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

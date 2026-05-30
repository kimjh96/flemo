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
import PlaygroundTransitionPicker from "./PlaygroundTransitionPicker";

function PlaygroundTransitionCard() {
  const pushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.pushTransitionOverride
  );
  const setPushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.setPushTransitionOverride
  );

  const active = transitionOptions.find((option) => option.value === pushTransitionOverride);

  return (
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
  );
}

export default PlaygroundTransitionCard;

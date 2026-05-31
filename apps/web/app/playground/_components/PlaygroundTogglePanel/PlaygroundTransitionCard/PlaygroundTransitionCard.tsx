"use client";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";
import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

import PlaygroundCodePeek from "../PlaygroundCodePeek";
import {
  naturalPushCode,
  transitionGroups,
  transitionOptions
} from "../PlaygroundTogglePanel.constants";
import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";
import PlaygroundTransitionPicker from "../PlaygroundTransitionPicker";

function PlaygroundTransitionCard() {
  const pushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.pushTransitionOverride
  );
  const setPushTransitionOverride = usePlaygroundSettingsStore(
    (state) => state.setPushTransitionOverride
  );
  const t = usePlaygroundDict().devPanel.transition;

  const active = transitionOptions.find((option) => option.value === pushTransitionOverride);

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="Screen transition"
        title={t.title}
        description={t.description}
      />
      <PlaygroundTransitionPicker
        groups={transitionGroups}
        value={pushTransitionOverride}
        onChange={setPushTransitionOverride}
      />
      <p className="text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
        {active ? `${t.overridePrefix}${t.summaries[active.value]}` : t.noOverride}
      </p>
      <PlaygroundCodePeek code={active ? active.code : naturalPushCode} />
    </PlaygroundToggleCard>
  );
}

export default PlaygroundTransitionCard;

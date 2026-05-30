"use client";

import PlaygroundBenchmarkCard from "./PlaygroundBenchmarkCard";
import PlaygroundInspectorCard from "./PlaygroundInspectorCard";
import PlaygroundNavigationCard from "./PlaygroundNavigationCard";
import PlaygroundSharedBarsCard from "./PlaygroundSharedBarsCard";
import PlaygroundTransitionCard from "./PlaygroundTransitionCard";

// The dev panel, shown beside the phone frame when the playground is visited
// directly (the embedded hero renders the bare Router instead). Each section
// is a card exposing one slice of flemo's surface, ordered from "what authored
// the app" (transitions, bars) through "what you can do" (navigation,
// performance) to "what's happening now" (the live inspector).
function PlaygroundTogglePanel() {
  return (
    <section className="mx-auto flex w-full max-w-[560px] flex-col gap-5 text-[var(--color-text-primary)]">
      <PlaygroundTransitionCard />
      <PlaygroundSharedBarsCard />
      <PlaygroundNavigationCard />
      <PlaygroundBenchmarkCard />
      <PlaygroundInspectorCard />
    </section>
  );
}

export default PlaygroundTogglePanel;

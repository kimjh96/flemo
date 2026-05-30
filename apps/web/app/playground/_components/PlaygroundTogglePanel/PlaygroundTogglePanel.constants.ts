import type { ColorSwatchOption } from "./PlaygroundColorSwatch";
import type { TransitionGroup, TransitionOption } from "./PlaygroundTogglePanel.types";

const cupertino: TransitionOption = {
  value: "cupertino",
  label: "cupertino",
  group: "Built-in",
  summary: "iOS-style horizontal push. Ships with @flemo/core.",
  code: `createTransition({
  name: "cupertino",
  initial: { x: "100%" },
  enter:     { value: { x: 0 },      options: { duration: 0.7 } },
  exit:      { value: { x: -100 },   options: { duration: 0.7 } },
  enterBack: { value: { x: "100%" }, options: { duration: 0.6 } },
  exitBack:  { value: { x: 0 },      options: { duration: 0.6 } }
});`
};

const material: TransitionOption = {
  value: "material",
  label: "material",
  group: "Built-in",
  summary: "Material-style vertical rise. Ships with @flemo/core.",
  code: `createTransition({
  name: "material",
  initial: { y: "100%" },
  enter:     { value: { y: 0 },      options: { duration: 0.35 } },
  exit:      { value: { y: -56 },    options: { duration: 0.35 } },
  enterBack: { value: { y: "100%" }, options: { duration: 0.25 } },
  exitBack:  { value: { y: 0 },      options: { duration: 0.25 } }
});`
};

const none: TransitionOption = {
  value: "none",
  label: "none",
  group: "Built-in",
  summary: "Instant swap, no animation. Useful for tab-like routing.",
  code: `createTransition({
  name: "none",
  initial: {},
  enter:     { value: {}, options: { duration: 0 } },
  exit:      { value: {}, options: { duration: 0 } },
  enterBack: { value: {}, options: { duration: 0 } },
  exitBack:  { value: {}, options: { duration: 0 } }
});`
};

const blur: TransitionOption = {
  value: "blur",
  label: "blur",
  group: "Custom",
  summary: "Author-defined with createTransition — lives in this playground, not the core.",
  code: `createTransition({
  name: "blur",
  initial: { filter: "blur(12px)", opacity: 0 },
  enter:     { value: { filter: "blur(0px)",  opacity: 1 }, options: { duration: 0.32 } },
  exit:      { value: { filter: "blur(12px)", opacity: 0 }, options: { duration: 0.32 } },
  enterBack: { value: { filter: "blur(12px)", opacity: 0 }, options: { duration: 0.28 } },
  exitBack:  { value: { filter: "blur(0px)",  opacity: 1 }, options: { duration: 0.28 } }
});`
};

// The "natural" code snippet — what each push site looks like by default.
// Shown when no override is active so the reader sees that per-context
// composition is the baseline, not a meta-option.
export const naturalPushCode = `// Library / Search → Album — browse deeper.
navigate.push("/album/:id", { id }, { transitionName: "cupertino" });

// Album / MiniPlayer → NowPlaying — the player dismisses with a
// downward chevron, so material's vertical rise matches the axis.
navigate.push("/now-playing", undefined, { transitionName: "material" });`;

export const transitionGroups: ReadonlyArray<TransitionGroup> = [
  {
    kind: "Built-in",
    caption: "Force one preset for every push.",
    options: [cupertino, material, none]
  },
  {
    kind: "Custom",
    caption: "Defined in this playground, not in @flemo/core.",
    options: [blur]
  }
];

export const transitionOptions: ReadonlyArray<TransitionOption> = transitionGroups.flatMap(
  (group) => group.options
);

// --- Screen chrome knobs ---------------------------------------------------

// Common bar heights: none, a thin status strip, an iOS-ish notch inset.
export const chromeHeightPresets = ["0px", "20px", "44px"] as const;

// Background must be opaque, so no "inherit" — pick from surface tokens.
export const chromeBackgroundOptions: ReadonlyArray<ColorSwatchOption> = [
  { label: "surface", value: "var(--color-surface)" },
  { label: "bg", value: "var(--color-bg)" },
  { label: "layer", value: "var(--color-layer)" }
];

// Bar tints may be left to Screen's own default ("" → inherit).
export const chromeBarColorOptions: ReadonlyArray<ColorSwatchOption> = [
  { label: "inherit", value: "" },
  { label: "surface", value: "var(--color-surface)" },
  { label: "layer", value: "var(--color-layer)" },
  { label: "primary", value: "var(--color-primary)" }
];

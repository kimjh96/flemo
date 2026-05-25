import type { TransitionGroup, TransitionOption } from "./PlaygroundTogglePanel.types";

const harmonized: TransitionOption = {
  value: "harmonized",
  label: "harmonized",
  group: "Default",
  summary:
    "Default. Each navigation picks the transition that matches its affordance — cupertino for browse-deeper hops, material for the player (which closes with a down chevron).",
  code: `function resolvePushTransition(target) {
  // Player closes with a downward chevron — match it with a
  // vertical rise so push and dismiss share one axis.
  if (target === "/now-playing") return "material";
  // Browse-deeper hops use the iOS horizontal push.
  return "cupertino";
}`
};

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

export const transitionGroups: ReadonlyArray<TransitionGroup> = [
  {
    kind: "Default",
    caption: "Per-destination resolution.",
    options: [harmonized]
  },
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

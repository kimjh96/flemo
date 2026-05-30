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

const zoom: TransitionOption = {
  value: "zoom",
  label: "zoom",
  group: "Custom",
  summary:
    "Cross-zoom dive — the new screen scales up into focus while the old one pushes forward and fades.",
  code: `createTransition({
  name: "zoom",
  initial: { scale: 0.8, opacity: 0 },
  enter:     { value: { scale: 1,    opacity: 1 }, options: { duration: 0.34 } },
  exit:      { value: { scale: 1.12, opacity: 0 }, options: { duration: 0.34 } },
  enterBack: { value: { scale: 0.8,  opacity: 0 }, options: { duration: 0.3 } },
  exitBack:  { value: { scale: 1,    opacity: 1 }, options: { duration: 0.3 } }
});`
};

const cardStack: TransitionOption = {
  value: "card-stack",
  label: "card-stack",
  group: "Custom",
  summary:
    "iOS-style card present — the new screen rises while the current one scales back and dims behind it.",
  code: `createTransition({
  name: "card-stack",
  initial: { y: "100%" },
  enter:     { value: { y: 0 },                       options: { duration: 0.4 } },
  exit:      { value: { scale: 0.93, opacity: 0.55 }, options: { duration: 0.4 } },
  enterBack: { value: { y: "100%" },                  options: { duration: 0.34 } },
  exitBack:  { value: { scale: 1,    opacity: 1 },    options: { duration: 0.34 } }
});`
};

const reveal: TransitionOption = {
  value: "reveal",
  label: "reveal",
  group: "Custom",
  summary:
    "Iris reveal — the new screen opens through a circular clip-path that grows to just cover the viewport, while the backdrop recedes.",
  code: `createTransition({
  name: "reveal",
  // 75% just covers the viewport (the farthest corner sits at ~70.7%),
  // so the whole duration is visible growth, not invisible overshoot.
  initial: { clipPath: "circle(0% at 50% 50%)" },
  enter:     { value: { clipPath: "circle(75% at 50% 50%)" }, options: { duration: 0.55, ease: [0.65, 0, 0.35, 1] } },
  exit:      { value: { scale: 0.94, opacity: 0.7 },          options: { duration: 0.55 } },
  enterBack: { value: { clipPath: "circle(0% at 50% 50%)" },  options: { duration: 0.45 } },
  exitBack:  { value: { scale: 1, opacity: 1 },               options: { duration: 0.45 } }
});`
};

const spring: TransitionOption = {
  value: "spring",
  label: "spring",
  group: "Custom",
  summary:
    "Springy pop — the new screen scales up with an overshooting ease, settling with a bounce.",
  code: `createTransition({
  name: "spring",
  initial: { scale: 0.7, opacity: 0 },
  enter:     { value: { scale: 1, opacity: 1 }, options: { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] } },
  exit:      { value: { scale: 0.96, opacity: 0 }, options: { duration: 0.3 } },
  enterBack: { value: { scale: 0.7, opacity: 0 },  options: { duration: 0.3 } },
  exitBack:  { value: { scale: 1, opacity: 1 },    options: { duration: 0.3 } }
});`
};

// Each combo co-designs the transition motion and the decorator as one idea.

const ripple: TransitionOption = {
  value: "ripple",
  label: "ripple",
  group: "Custom + decorator",
  summary:
    "A drop in water: the screen reveals through a circle expanding from the center, and concentric rings radiate from that same point on the backdrop — reveal and ripples share one origin.",
  code: `const ripples = createDecorator({
  name: "ripples",
  initial: { background: RINGS, opacity: 0, scale: 0.3 }, // repeating-radial-gradient
  enter:   { value: { background: RINGS, opacity: 1, scale: 2.2 }, options: { duration: 0.55 } },
  exit:    { value: { background: RINGS, opacity: 0, scale: 0.3 }, options: { duration: 0.4 } }
});

createTransition({
  name: "ripple",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  enter:   { value: { clipPath: "circle(75% at 50% 50%)" }, options: { duration: 0.55 } },
  options: { decoratorName: "ripples" }
});`
};

const dive: TransitionOption = {
  value: "dive",
  label: "dive",
  group: "Custom + decorator",
  summary:
    "Diving forward through depth: the screen rushes in from a point at the center while the backdrop scales out into a closing dark tunnel — both read as the same plunge into depth.",
  code: `const tunnel = createDecorator({
  name: "tunnel",
  initial: { background: TUNNEL, opacity: 0, scale: 1 },
  enter:   { value: { background: TUNNEL, opacity: 1, scale: 1.4 }, options: { duration: 0.5 } },
  exit:    { value: { background: TUNNEL, opacity: 0, scale: 1 },   options: { duration: 0.4 } }
});

createTransition({
  name: "dive",
  initial: { scale: 0.2, opacity: 0 },
  enter:   { value: { scale: 1, opacity: 1 },    options: { duration: 0.5 } },
  exit:    { value: { scale: 1.4, opacity: 0 },  options: { duration: 0.5 } }, // backdrop rushes past
  options: { decoratorName: "tunnel" }
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
    options: [blur, zoom, cardStack, reveal, spring]
  },
  {
    kind: "Custom + decorator",
    caption: "A custom transition paired with a custom createDecorator layer.",
    options: [ripple, dive]
  }
];

export const transitionOptions: ReadonlyArray<TransitionOption> = transitionGroups.flatMap(
  (group) => group.options
);

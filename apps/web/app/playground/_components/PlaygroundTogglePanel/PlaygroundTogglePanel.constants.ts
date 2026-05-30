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
    "Iris reveal — the new screen opens through a growing circular clip-path while the backdrop recedes.",
  code: `createTransition({
  name: "reveal",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  enter:     { value: { clipPath: "circle(150% at 50% 50%)" }, options: { duration: 0.45 } },
  exit:      { value: { scale: 0.92, opacity: 0.6 },          options: { duration: 0.45 } },
  enterBack: { value: { clipPath: "circle(0% at 50% 50%)" },   options: { duration: 0.35 } },
  exitBack:  { value: { scale: 1, opacity: 1 },                options: { duration: 0.35 } }
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

const spotlight: TransitionOption = {
  value: "spotlight",
  label: "spotlight",
  group: "Custom + decorator",
  summary:
    "Focus zoom paired with a radial vignette decorator that darkens the backgrounding screen's edges.",
  code: `// A transition + decorator combo, linked by decoratorName.
const vignette = createDecorator({
  name: "vignette",
  initial: { opacity: 0, background: RADIAL_VIGNETTE },
  enter:   { value: { opacity: 1, background: RADIAL_VIGNETTE }, options: { duration: 0.4 } },
  exit:    { value: { opacity: 0, background: RADIAL_VIGNETTE }, options: { duration: 0.32 } }
});

createTransition({
  name: "spotlight",
  initial: { scale: 0.92, opacity: 0 },
  enter:   { value: { scale: 1, opacity: 1 }, options: { duration: 0.4 } },
  exit:    { value: { scale: 0.96 },          options: { duration: 0.4 } },
  options: { decoratorName: "vignette" }
});`
};

const sheet: TransitionOption = {
  value: "sheet",
  label: "sheet",
  group: "Custom + decorator",
  summary:
    "A bottom sheet rises while a frost decorator washes a soft light haze over the backdrop.",
  code: `const frost = createDecorator({
  name: "frost",
  initial: { opacity: 0, backgroundColor: "rgba(247,248,250,0.6)" },
  enter:   { value: { opacity: 1, backgroundColor: "rgba(247,248,250,0.6)" }, options: { duration: 0.42 } },
  exit:    { value: { opacity: 0, backgroundColor: "rgba(247,248,250,0.6)" }, options: { duration: 0.34 } }
});

createTransition({
  name: "sheet",
  initial: { y: "100%" },
  enter:   { value: { y: 0 },  options: { duration: 0.42 } },
  exit:    { value: {},        options: { duration: 0.42 } }, // backdrop stays; frost reads
  options: { decoratorName: "frost" }
});`
};

const swoosh: TransitionOption = {
  value: "swoosh",
  label: "swoosh",
  group: "Custom + decorator",
  summary:
    "Diagonal corner entry over a cinematic scrim decorator — a dark gradient, heavier at the bottom.",
  code: `const scrim = createDecorator({
  name: "scrim",
  initial: { opacity: 0, background: BOTTOM_SCRIM },
  enter:   { value: { opacity: 1, background: BOTTOM_SCRIM }, options: { duration: 0.4 } },
  exit:    { value: { opacity: 0, background: BOTTOM_SCRIM }, options: { duration: 0.32 } }
});

createTransition({
  name: "swoosh",
  initial: { x: "40%", y: "40%", opacity: 0.3 },
  enter:   { value: { x: 0, y: 0, opacity: 1 }, options: { duration: 0.4 } },
  options: { decoratorName: "scrim" }
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
    options: [spotlight, sheet, swoosh]
  }
];

export const transitionOptions: ReadonlyArray<TransitionOption> = transitionGroups.flatMap(
  (group) => group.options
);

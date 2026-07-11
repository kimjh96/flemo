import type { LabTransition } from "../_providers/LabSettingsProvider";

// The catalog that drives both the picker UI and the "View source" panel.
// Built-in transitions ship with @flemo/react (no authored source in this app);
// custom ones are authored under _transitions/ and carry that source (minus the
// "use client" directive, which the viewer has no reason to show).
// `dive` and `ripple` additionally run a decorator (the tunnel vignette / the
// water ripples), defined in the same source file via createDecorator.
export type TransitionKind = "built-in" | "custom";
export type LabDecorator = "tunnel" | "ripples";

export interface LabTransitionMeta {
  slug: LabTransition;
  label: string;
  kind: TransitionKind;
  // Present only for the two combos that pair a transition with a decorator.
  decorator?: LabDecorator;
  // The authored _transitions/*.ts source, minus the leading "use client"
  // directive (a Next.js framework marker, not part of the transition).
  // Absent for built-ins.
  source?: string;
}

// Drops the leading "use client"; directive so the viewer shows the transition
// itself, not the framework boilerplate the directive represents.
function authoredSource(raw: string): string {
  return raw.replace(/^"use client";\n+/, "");
}

const FADE_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.4, 0, 0.2, 1] as const;

// A plain cross-fade, authored with createTransition, one of the custom
// transitions selectable in the playground control panel.
const labFade = createTransition({
  name: "fade",
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  enter: { value: { opacity: 1 }, options: { duration: 0.3, ease: EASE } },
  enterBack: { value: { opacity: 0 }, options: { duration: 0.26, ease: EASE } },
  exit: { value: { opacity: 0 }, options: { duration: 0.3, ease: EASE } },
  exitBack: { value: { opacity: 1 }, options: { duration: 0.26, ease: EASE } }
});

export default labFade;
`;

const ZOOM_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.32, 0.72, 0, 1] as const;

// A cross-zoom: the incoming screen scales up into focus while the outgoing one
// pushes slightly forward and fades. Another custom transition for the panel.
const labZoom = createTransition({
  name: "zoom",
  initial: { scale: 0.92, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { scale: 1, opacity: 1 }, options: { duration: 0.34, ease: EASE } },
  enterBack: { value: { scale: 0.92, opacity: 0 }, options: { duration: 0.28, ease: EASE } },
  exit: { value: { scale: 1.04, opacity: 0 }, options: { duration: 0.34, ease: EASE } },
  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.28, ease: EASE } }
});

export default labZoom;
`;

const BLUR_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

// Blur + fade. The entering screen lifts out of focus and settles crisp; the
// leaving screen drifts back into focus and fades. \`filter: blur()\` interpolates
// natively, so this is a single compiled keyframe per variant, no JS in the loop.
const blur = createTransition({
  name: "blur",
  initial: { filter: "blur(12px)", opacity: 0 },
  idle: { value: { filter: "blur(0px)", opacity: 1 }, options: { duration: 0 } },
  enter: {
    value: { filter: "blur(0px)", opacity: 1 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { filter: "blur(12px)", opacity: 0 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { filter: "blur(12px)", opacity: 0 },
    options: { duration: 0.32, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { filter: "blur(0px)", opacity: 1 },
    options: { duration: 0.28, ease: [0.32, 0.72, 0, 1] }
  }
});

export default blur;
`;

const REVEAL_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

// Iris reveal. The entering screen opens through a circular \`clip-path\` growing
// from the center until it covers the viewport (75% reaches the far corner at
// any aspect ratio). The screen underneath recedes and dims.
const reveal = createTransition({
  name: "reveal",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  idle: {
    value: { clipPath: "circle(75% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(75% at 50% 50%)" },
    options: { duration: 0.55, ease: [0.65, 0, 0.35, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)" },
    options: { duration: 0.45, ease: [0.65, 0, 0.35, 1] }
  },
  exit: {
    value: { scale: 0.94, opacity: 0.7 },
    options: { duration: 0.55, ease: [0.65, 0, 0.35, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.45, ease: [0.65, 0, 0.35, 1] }
  }
});

export default reveal;
`;

const DIVE_SOURCE = `"use client";

import { createDecorator, createTransition } from "@flemo/react";

// Diving forward through depth. The new screen rushes in from a tiny point
// (scale 0.2) while the old one scales up and out as a dark tunnel vignette
// closes around it, reading as rushing past into the distance.
const TUNNEL = "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 12%, rgba(0,0,0,0.78) 78%)";

export const tunnel = createDecorator({
  name: "tunnel",
  initial: { background: TUNNEL, opacity: 0, scale: 1 },
  idle: { value: { background: TUNNEL, opacity: 0, scale: 1 }, options: { duration: 0 } },
  enter: {
    value: { background: TUNNEL, opacity: 1, scale: 1.4 },
    options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { background: TUNNEL, opacity: 0, scale: 1 }, options: { duration: 0.4 } }
});

const dive = createTransition({
  name: "dive",
  initial: { scale: 0.2, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { scale: 1, opacity: 1 }, options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
  enterBack: {
    value: { scale: 0.2, opacity: 0 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { scale: 1.4, opacity: 0 }, options: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  options: { decoratorName: "tunnel" }
});

export default dive;
`;

const RIPPLE_SOURCE = `"use client";

import { createDecorator, createTransition } from "@flemo/react";

// A drop in water. The new screen is revealed through a circle expanding from
// the center, and the screen behind it carries concentric rings radiating from
// the same origin, so they read as one splash.
const RIPPLES =
  "repeating-radial-gradient(circle at 50% 50%, rgba(130,170,255,0) 0%, rgba(130,170,255,0) 6%, rgba(130,170,255,0.32) 7%, rgba(130,170,255,0) 8.5%)";

export const ripples = createDecorator({
  name: "ripples",
  initial: { background: RIPPLES, opacity: 0, scale: 0.3 },
  idle: { value: { background: RIPPLES, opacity: 0, scale: 0.3 }, options: { duration: 0 } },
  enter: {
    value: { background: RIPPLES, opacity: 1, scale: 2.2 },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { background: RIPPLES, opacity: 0, scale: 0.3 }, options: { duration: 0.4 } }
});

const ripple = createTransition({
  name: "ripple",
  initial: { clipPath: "circle(0% at 50% 50%)" },
  idle: {
    value: { clipPath: "circle(75% at 50% 50%)", scale: 1, opacity: 1 },
    options: { duration: 0 }
  },
  enter: {
    value: { clipPath: "circle(75% at 50% 50%)" },
    options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] }
  },
  enterBack: {
    value: { clipPath: "circle(0% at 50% 50%)" },
    options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] }
  },
  exit: { value: { scale: 0.96 }, options: { duration: 0.55, ease: [0.32, 0.72, 0, 1] } },
  exitBack: { value: { scale: 1 }, options: { duration: 0.42, ease: [0.32, 0.72, 0, 1] } },
  options: { decoratorName: "ripples" }
});

export default ripple;
`;

const CARD_STACK_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

// iOS-style card present. The entering screen rises from the bottom while the
// one it covers scales back and dims, stacking behind like a sheet over a
// dimmed backdrop. On pop the card slides back down.
const cardStack = createTransition({
  name: "card-stack",
  initial: { y: "100%" },
  idle: { value: { y: 0, scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { y: 0 }, options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] } },
  enterBack: { value: { y: "100%" }, options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] } },
  exit: {
    value: { scale: 0.93, opacity: 0.55 },
    options: { duration: 0.4, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.34, ease: [0.32, 0.72, 0, 1] }
  }
});

export default cardStack;
`;

const SPRING_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

// Springy pop. The entering screen scales up from small with an overshooting
// "back" easing (it springs slightly past 1 before settling), so the arrival
// feels physical. The leaving screen recedes and fades.
const spring = createTransition({
  name: "spring",
  initial: { scale: 0.7, opacity: 0 },
  idle: { value: { scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.42, ease: [0.34, 1.56, 0.64, 1] }
  },
  enterBack: {
    value: { scale: 0.7, opacity: 0 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exit: {
    value: { scale: 0.96, opacity: 0 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  },
  exitBack: {
    value: { scale: 1, opacity: 1 },
    options: { duration: 0.3, ease: [0.32, 0.72, 0, 1] }
  }
});

export default spring;
`;

const WIPE_SOURCE = `"use client";

import { createTransition } from "@flemo/react";

const EASE = [0.65, 0, 0.35, 1] as const;

// An edge wipe: the entering screen is revealed left-to-right by an inset
// clip. The two clip-path endpoints deliberately use DIFFERENT templates
// (four components vs the one-value shorthand) — a value pair only the
// browser's own interpolation can pair, exercising flemo's scrubbed
// Web-Animation tier. The screen underneath recedes slightly.
const wipe = createTransition({
  name: "wipe",
  initial: { clipPath: "inset(0 0 0 100%)" },
  idle: { value: { clipPath: "inset(0)", scale: 1, opacity: 1 }, options: { duration: 0 } },
  enter: { value: { clipPath: "inset(0)" }, options: { duration: 0.45, ease: EASE } },
  enterBack: { value: { clipPath: "inset(0 0 0 100%)" }, options: { duration: 0.38, ease: EASE } },
  exit: { value: { scale: 0.96, opacity: 0.8 }, options: { duration: 0.45, ease: EASE } },
  exitBack: { value: { scale: 1, opacity: 1 }, options: { duration: 0.38, ease: EASE } }
});

export default wipe;
`;

export const TRANSITIONS: LabTransitionMeta[] = [
  { slug: "cupertino", label: "Cupertino", kind: "built-in" },
  { slug: "material", label: "Material", kind: "built-in" },
  { slug: "none", label: "None", kind: "built-in" },
  { slug: "fade", label: "Fade", kind: "custom", source: authoredSource(FADE_SOURCE) },
  { slug: "zoom", label: "Zoom", kind: "custom", source: authoredSource(ZOOM_SOURCE) },
  { slug: "blur", label: "Blur", kind: "custom", source: authoredSource(BLUR_SOURCE) },
  { slug: "reveal", label: "Reveal", kind: "custom", source: authoredSource(REVEAL_SOURCE) },
  {
    slug: "dive",
    label: "Dive",
    kind: "custom",
    decorator: "tunnel",
    source: authoredSource(DIVE_SOURCE)
  },
  {
    slug: "ripple",
    label: "Ripple",
    kind: "custom",
    decorator: "ripples",
    source: authoredSource(RIPPLE_SOURCE)
  },
  {
    slug: "card-stack",
    label: "Card stack",
    kind: "custom",
    source: authoredSource(CARD_STACK_SOURCE)
  },
  { slug: "spring", label: "Spring", kind: "custom", source: authoredSource(SPRING_SOURCE) },
  { slug: "wipe", label: "Wipe", kind: "custom", source: authoredSource(WIPE_SOURCE) }
];

export interface TransitionGroup {
  kind: TransitionKind;
  label: string;
  items: LabTransitionMeta[];
}

export const TRANSITION_GROUPS: TransitionGroup[] = [
  { kind: "built-in", label: "Built-in", items: TRANSITIONS.filter((t) => t.kind === "built-in") },
  { kind: "custom", label: "Custom", items: TRANSITIONS.filter((t) => t.kind === "custom") }
];

export function transitionMetaBySlug(slug: LabTransition): LabTransitionMeta | undefined {
  return TRANSITIONS.find((transition) => transition.slug === slug);
}

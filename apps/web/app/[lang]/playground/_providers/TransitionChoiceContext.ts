"use client";

import { createContext, useContext } from "react";

import type { MorphTransitionName, TransitionName } from "@flemo/react";

// WHAT THE BENCH IS SET TO — two independent axes, because that is what the
// library claims and the fixture exists to show it.
//
// A screen transition and a shared element are separate systems that compose:
// the transition carries everything behind the element, the morph carries the
// element. So they are two controls, not a list of pre-mixed cases, and either
// one can be looked at with the other turned off.
export interface TransitionCase {
  id: TransitionName;
  label: string;
  /** Whether flemo ships it or the site authored it, which is worth knowing. */
  origin: "built-in" | "authored here";
  /** What to watch, in one line. */
  note: string;
  /**
   * Whether the destination's shared element covers the frame edge to edge.
   * A property of the SCREEN transition: `sheet` is authored to hand the whole
   * frame to the element opening over it.
   */
  fullBleed?: boolean;
}

export interface MorphCase {
  id: string;
  label: string;
  note: string;
  /** Undefined is the honest value for "no shared element in this navigation". */
  name?: MorphTransitionName;
}

export const TRANSITIONS: TransitionCase[] = [
  {
    id: "cupertino",
    label: "cupertino",
    origin: "built-in",
    note: "slides in from the right, over a screen that recedes under a dim"
  },
  {
    id: "material",
    label: "material",
    origin: "built-in",
    note: "rises from below and fades in"
  },
  {
    id: "layout",
    label: "layout",
    origin: "built-in",
    note: "one screen fades at a time — nothing moves, so a shared element is the whole show"
  },
  {
    id: "none",
    label: "none",
    origin: "built-in",
    note: "an instant cut: whatever still moves is not the screen transition"
  },
  {
    id: "fade",
    label: "fade",
    origin: "authored here",
    note: "the arrival fades in over a screen that holds perfectly still"
  },
  {
    id: "raise",
    label: "raise",
    origin: "authored here",
    note: "createRawTransition — up into place on a push, down and out faster on a pop"
  },
  {
    id: "drift",
    label: "drift",
    origin: "authored here",
    note: "reveal-shaped: everything happens on the arriving screen"
  },
  {
    id: "sheet",
    label: "sheet",
    origin: "authored here",
    note: "the screen behind scales up and blurs while the element opens over it",
    fullBleed: true
  }
];

export const MORPHS: MorphCase[] = [
  {
    id: "off",
    label: "off",
    note: "no shared element: the screen transition is the only thing running"
  },
  {
    id: "shared",
    label: "shared",
    name: "shared",
    note: "the card, its artwork and its title each cross on their own"
  },
  {
    id: "zoom",
    label: "zoom",
    name: "zoom",
    note: "container transform — the grid itself zooms into the tapped card"
  }
];

export interface PlaygroundChoice {
  transition: TransitionCase;
  morph: MorphCase;
}

const DEFAULT_CHOICE: PlaygroundChoice = {
  transition: TRANSITIONS[2]!,
  morph: MORPHS[1]!
};

const TransitionChoiceContext = createContext<PlaygroundChoice>(DEFAULT_CHOICE);

export const useTransitionChoice = () => useContext(TransitionChoiceContext);

export default TransitionChoiceContext;

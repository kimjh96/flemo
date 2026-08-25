"use client";

import { createContext, useContext } from "react";

import type { MorphTransitionName, TransitionName } from "@flemo/react";

// WHAT THE BENCH IS SET TO: two independent axes, because that is what the
// library claims and the fixture exists to show.
//
// A screen transition and a shared element are separate systems that compose:
// the transition carries everything behind the element, the morph carries the
// element. So they are two controls, not a list of pre-mixed cases, and either
// one can be looked at with the other turned off.
export interface TransitionCase {
  id: TransitionName & ("cupertino" | "material" | "layout" | "none" | "fade" | "sheet");
  label: string;
  /** Whether flemo ships it or the site authored it, which is worth knowing. */
  origin: "built-in" | "authored here";
  /**
   * Whether this transition TRANSLATES its screens. The app bar's contents are
   * authored against it: a label that slides over a screen that only fades is
   * inventing a direction the flight does not have, and a label that twitches
   * over a screen carrying a full width reads as unrelated to it.
   */
  slides?: boolean;
  /**
   * Whether the destination's shared element covers the frame edge to edge.
   * A property of the SCREEN transition: `sheet` is authored to hand the whole
   * frame to the element opening over it.
   */
  fullBleed?: boolean;
}

export interface MorphCase {
  id: "off" | "shared" | "zoom";
  label: string;
  /** Undefined is the honest value for "no shared element in this navigation". */
  name?: MorphTransitionName;
}

export const TRANSITIONS: TransitionCase[] = [
  {
    id: "cupertino",
    label: "cupertino",
    origin: "built-in",
    slides: true
  },
  {
    id: "material",
    label: "material",
    origin: "built-in",
    slides: true
  },
  {
    id: "layout",
    label: "layout",
    origin: "built-in"
  },
  {
    id: "none",
    label: "none",
    origin: "built-in"
  },
  {
    id: "fade",
    label: "fade",
    origin: "authored here"
  },
  {
    id: "sheet",
    label: "sheet",
    origin: "authored here",
    fullBleed: true
  }
];

export const MORPHS: MorphCase[] = [
  {
    id: "off",
    label: "off"
  },
  {
    id: "shared",
    label: "shared",
    name: "shared"
  },
  {
    id: "zoom",
    label: "zoom",
    name: "zoom"
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

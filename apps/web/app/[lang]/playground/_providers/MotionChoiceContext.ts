"use client";

import { createContext, useContext } from "react";

import type { MorphTransitionName, TransitionName } from "@flemo/react";

import { barPartFor, bodyPartFor } from "../_transitions/clocks";

// WHAT THE BENCH IS SET TO, and everything that follows from it.
//
// Two independent axes, because that is what the library claims and what the
// case exists to show: a screen transition carries everything behind the
// element, a morph carries the element, and either can be looked at with the
// other turned off. Anything that only works in one combination shows up as a
// broken cell.
//
// The important part is what this context DERIVES. A screen does not choose a
// part transition; it asks for `barPart` and `bodyPart` and gets the ones
// belonging to the transition currently flying. That is the single rule this
// rebuild is built on — a <Part> has no clock of its own to inherit, so its
// clock has to be selected with the transition, in one place, rather than
// hardcoded next to each element that uses it.
export interface TransitionCase {
  id: TransitionName & ("cupertino" | "material" | "layout" | "none" | "fade" | "sheet");
  /** Whether flemo ships it or the site authored it, which is worth knowing. */
  origin: "built-in" | "authored";
  /**
   * Whether the destination's shared element covers the frame edge to edge.
   * A property of the SCREEN transition: `sheet` is authored to hand the whole
   * frame to the element opening over it.
   */
  fullBleed?: boolean;
}

export interface MorphCase {
  id: "off" | "shared" | "zoom";
  /** Undefined is the honest value for "no shared element in this navigation". */
  name?: MorphTransitionName;
}

export const TRANSITIONS: TransitionCase[] = [
  { id: "cupertino", origin: "built-in" },
  { id: "material", origin: "built-in" },
  { id: "layout", origin: "built-in" },
  { id: "none", origin: "built-in" },
  { id: "fade", origin: "authored" },
  { id: "sheet", origin: "authored", fullBleed: true }
];

export const MORPHS: MorphCase[] = [
  { id: "off" },
  { id: "shared", name: "shared" },
  { id: "zoom", name: "zoom" }
];

export interface MotionChoice {
  transition: TransitionCase;
  morph: MorphCase;
}

export const DEFAULT_CHOICE: MotionChoice = {
  // cupertino by default: it is the preset with the platform gesture, the
  // longest clock, and the one whose desync the old bench hid. A bench should
  // open on the case that is hardest to get right.
  transition: TRANSITIONS[0]!,
  morph: MORPHS[1]!
};

const MotionChoiceContext = createContext<MotionChoice>(DEFAULT_CHOICE);

export interface ResolvedMotion extends MotionChoice {
  /** The part transition for the shared bar's contents, on this flight's clock. */
  barPart: string;
  /** The part transition for the screen's own content, on this flight's clock. */
  bodyPart: string;
}

// A screen asks for a part by role and gets one already matched to the flight.
// Whether that flight translates its screens is settled inside the part factory
// from the same clock row, so no screen has to know and none of them branch
// on it.
export function useMotionChoice(): ResolvedMotion {
  const choice = useContext(MotionChoiceContext);

  return {
    ...choice,
    barPart: barPartFor(choice.transition.id),
    bodyPart: bodyPartFor(choice.transition.id)
  };
}

export default MotionChoiceContext;

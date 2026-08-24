"use client";

import { createContext, useContext } from "react";

import type { MorphTransitionName, TransitionName } from "@flemo/react";

// What the strip above the stage has selected. A morph is supposed to be
// independent of the screen transition, so the fixture makes both switchable
// and puts the claim where it can be looked at.
export interface PlaygroundChoice {
  id: string;
  label: string;
  note: string;
  /** The screen transition the fixture pushes with. */
  transitionName: TransitionName;
  /** The morph transition the CARD runs. Its contents keep their own. */
  morphName?: MorphTransitionName;
  /** Whether the detail screen's card covers the viewport edge to edge. */
  fullBleed?: boolean;
}

export const CHOICES: PlaygroundChoice[] = [
  {
    id: "layout",
    label: "layout",
    note: "arrives in place — the shared element is the whole show",
    transitionName: "layout"
  },
  {
    id: "cupertino",
    label: "cupertino",
    note: "slides in from the right, underneath the element",
    transitionName: "cupertino"
  },
  {
    id: "material",
    label: "material",
    note: "rises from below, underneath the element",
    transitionName: "material"
  },
  {
    id: "none",
    label: "none",
    note: "instant cut, so the morph is the only motion",
    transitionName: "none"
  },
  {
    id: "sheet",
    label: "sheet",
    note: "the element becomes the whole screen while the background scales up and blurs with it",
    transitionName: "sheet",
    fullBleed: true
  },
  {
    id: "zoom",
    label: "zoom",
    // The A/B against `sheet` directly above it: the same screens, the same
    // screen transition, the same element — one variable changed, the morph's
    // `carry: "screen"`. What that buys is the grid moving as though the
    // viewport pushed in on the tapped card, instead of staying put while the
    // card leaves it.
    note: "container transform — the whole grid zooms into the tapped card and is pushed off the edges",
    transitionName: "sheet",
    morphName: "zoom",
    fullBleed: true
  }
];

const TransitionChoiceContext = createContext<PlaygroundChoice>(CHOICES[0]!);

export const useTransitionChoice = () => useContext(TransitionChoiceContext);

export default TransitionChoiceContext;

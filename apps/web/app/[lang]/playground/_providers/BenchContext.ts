"use client";

import { createContext, useContext } from "react";

import type { MorphTransitionName, TransitionName } from "@flemo/react";

// What the bench is set to.
//
// STILL ONE AXIS, even though there are now two things behind each entry. The
// axis is "what carries the push", and an entry names both halves of the answer
// because the two halves are not independent:
//
//   zoom.ts
//     "PAIR IT WITH A STILL SCREEN TRANSITION. The camera supersedes that
//      screen's own transform for the flight, so `none` or an opacity-only
//      transition composes; a slide is replaced rather than combined."
//
// Offering a free cross product would put combinations on the page that the
// library states do not compose, and a reader who picked one would be told by
// the motion that flemo is broken. The previous playground did exactly that and
// is why this one was rebuilt.
export interface BenchCase {
  // What the control shows, and what the case is called in the comments.
  id: string;
  transition: TransitionName;
  // Which morph the ARTWORK flies as: the built-in `shared`, which is what the
  // deleted playground used for the same gradient.
  morph: MorphTransitionName;
  // Which morph the CARD flies as, where there is a card. Null everywhere but
  // the container transform, where it is the built-in `zoom`: the card's ghost
  // (crossFade 0.55) is what covers the arriving page's narrow-width layout for
  // the first half of the flight, and its `carry` is the camera. The deleted
  // playground ran on exactly this, with no part transitions inside the card.
  cardMorph: MorphTransitionName | null;
}

// The four the library ships, then the four this page authors. Presets first so
// the familiar ones are where a reader looks for them, and the authored ones
// after, because the point of having them here is that a consumer's transition
// is not a second class of thing.
//
// Each authored entry covers something the presets do not:
//   reveal        a clip-path wipe, on a property no preset animates
//   drift         depth, with a decorator sized to its own clock
//   sheet         a modal rising from the bottom edge, asymmetric clocks
//   tether        a swipe of the consumer's own: a drag that spends one
//                 property early and keeps another going, and a hook carrying
//                 one element by hand while flemo keeps the screens
//   zoom          the container transform, and the still transition it needs
export const CASES: BenchCase[] = [
  { id: "cupertino", transition: "cupertino", morph: "shared", cardMorph: null },
  { id: "material", transition: "material", morph: "shared", cardMorph: null },
  { id: "layout", transition: "layout", morph: "shared", cardMorph: null },
  { id: "none", transition: "none", morph: "shared", cardMorph: null },
  { id: "reveal", transition: "reveal", morph: "shared", cardMorph: null },
  { id: "drift", transition: "drift", morph: "shared", cardMorph: null },
  { id: "sheet", transition: "sheet", morph: "shared", cardMorph: null },
  { id: "tether", transition: "tether", morph: "shared", cardMorph: null },
  { id: "zoom", transition: "aperture", morph: "shared", cardMorph: "zoom" }
];

// The container transform opens the bench: it is the case this stage was
// rebuilt around, and the one that shows the most of the library at a glance.
export const DEFAULT_BENCH: BenchCase = CASES.find((entry) => entry.id === "zoom")!;

const BenchContext = createContext<BenchCase>(DEFAULT_BENCH);

export const useBench = () => useContext(BenchContext);

export default BenchContext;

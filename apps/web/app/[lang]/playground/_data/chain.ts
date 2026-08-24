import type { MorphTransitionName, TransitionName } from "@flemo/react";

// THE CHAIN: one stack, five pushes, a different transition on each — two of
// them carrying a morph. The question it exists to answer is not whether any
// one transition works (the strip above already shows that) but whether they
// still work STACKED: whether a morph flight leaves anything behind for the
// next transition to trip on, and whether five pops unwind five different
// transitions in the right order.
export interface ChainStep {
  id: string;
  label: string;
  /** The transition that PUSHES to this step (and pops back out of it). */
  transitionName: TransitionName;
  /** Set when this step arrives by morph: the preset the shared element runs. */
  morphName?: MorphTransitionName;
  /** Whether the shared element covers this screen edge to edge. */
  fullBleed?: boolean;
  note: string;
  hue: number;
}

export const CHAIN: ChainStep[] = [
  {
    // The bottom of the stack: nothing pushed TO it, so its transition name is
    // never used. It exists so the FIRST push in the chain is a real one —
    // without it `cupertino` would only ever be the initial screen's rest
    // state, which is not the thing being tested.
    id: "start",
    label: "Start",
    transitionName: "none",
    note: "the bottom of the stack",
    hue: 200
  },
  {
    id: "a",
    label: "A",
    transitionName: "cupertino",
    note: "cupertino — slides in from the right",
    hue: 214
  },
  {
    id: "b",
    label: "B",
    transitionName: "sheet",
    morphName: "zoom",
    fullBleed: true,
    note: "zoom morph — the card opens into the screen and the grid zooms with it",
    hue: 268
  },
  {
    id: "c",
    label: "C",
    transitionName: "material",
    note: "material — rises from below",
    hue: 154
  },
  {
    id: "d",
    label: "D",
    transitionName: "drift",
    note: "drift — a consumer transition flemo does not ship",
    hue: 28
  },
  {
    id: "e",
    label: "E",
    transitionName: "layout",
    morphName: "shared",
    note: "layout + shared morph — the element arrives in place",
    hue: 330
  }
];

export const stepAt = (id: string | undefined): { step: ChainStep; index: number } | null => {
  const index = CHAIN.findIndex((entry) => entry.id === id);
  return index < 0 ? null : { step: CHAIN[index]!, index };
};

export const surfaceFor = (hue: number) =>
  `linear-gradient(150deg, hsl(${hue} 82% 62%), hsl(${(hue + 46) % 360} 74% 46%))`;

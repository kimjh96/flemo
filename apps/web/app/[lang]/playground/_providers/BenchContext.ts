"use client";

import { createContext, useContext } from "react";

import type { TransitionName } from "@flemo/react";

// What the bench is set to. Deliberately ONE axis.
//
// The previous playground offered a transition axis crossed with a morph axis
// and a per-step clock table, and got the basics wrong underneath all of it.
// The library author's own demos pair one element and change nothing else; this
// starts there. A second axis goes in only once the first one is judged good.
export interface Bench {
  transition: TransitionName;
}

// The four the library ships, then the three this page authors. Presets first
// so the familiar ones are where a reader looks for them, and the authored ones
// after, because the point of having them here is that a consumer's transition
// is not a second class of thing.
//
// Each authored entry exists for something the presets do not cover:
//   reveal        a clip-path wipe, on a property no preset animates
//   drift         depth, with a decorator sized to its own clock
//   fade-through  two fades in sequence rather than overlapped
export const TRANSITIONS: TransitionName[] = [
  "cupertino",
  "material",
  "layout",
  "none",
  "reveal",
  "drift",
  "fade-through"
];

export const DEFAULT_BENCH: Bench = { transition: "cupertino" };

const BenchContext = createContext<Bench>(DEFAULT_BENCH);

export const useBench = () => useContext(BenchContext);

export default BenchContext;

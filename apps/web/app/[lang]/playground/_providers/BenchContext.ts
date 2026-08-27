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

export const TRANSITIONS: TransitionName[] = ["cupertino", "material", "layout", "none", "reveal"];

export const DEFAULT_BENCH: Bench = { transition: "cupertino" };

const BenchContext = createContext<Bench>(DEFAULT_BENCH);

export const useBench = () => useContext(BenchContext);

export default BenchContext;

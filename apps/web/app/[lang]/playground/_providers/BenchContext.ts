"use client";

import { createContext, useContext } from "react";

import type { TransitionName } from "@flemo/react";

// What the bench is set to.
//
// TWO controls, and they behave differently on purpose:
//
//   `transition`  remounts the app, so a change starts from a clean stack
//                 rather than landing mid-flight.
//   `hosted`      does NOT remount. It is the single variable of the overlay
//                 comparison, and the arrangement it exists to show is a sheet
//                 that is ALREADY OPEN while a screen moves. A toggle that
//                 closed the sheet could never reach it.
export interface Bench {
  transition: TransitionName;
  /** `true` renders the sheet through `<Layer>`; `false` writes it in the screen. */
  hosted: boolean;
}

export const TRANSITIONS: TransitionName[] = ["cupertino", "material", "layout", "none", "reveal"];

export const DEFAULT_BENCH: Bench = { transition: "cupertino", hosted: true };

const BenchContext = createContext<Bench>(DEFAULT_BENCH);

export const useBench = () => useContext(BenchContext);

export default BenchContext;

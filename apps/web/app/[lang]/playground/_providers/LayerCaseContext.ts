"use client";

import { createContext, useContext } from "react";

import type { getDict } from "@/lib/i18n";

export type LayerCopy = ReturnType<typeof getDict>["playground"]["layer"];

// The layering case's state, held ABOVE both Routers.
//
// Not a detail. An earlier version kept these in the screen's own useState, so
// pushing mounted a fresh screen with the sheet closed and the toggle back at
// its default — which meant the one arrangement the case exists to show (a
// sheet that is open WHILE a screen moves) could not be reached by using it.
// State that survives navigation is the case.
export interface LayerCase {
  /**
   * WHICH screen has the sheet up, not merely whether one does. An overlay
   * belongs to one screen; a shared boolean would put an identical sheet on
   * both of them and quietly make "does it travel with its screen" a question
   * about whichever copy the query happened to find first.
   */
  openOn: "A" | "B" | "SOLO" | null;
  setOpenOn: (step: "A" | "B" | "SOLO" | null) => void;
  /**
   * The single variable. `true` hosts the sheet outside its screen with
   * <Layer>; `false` writes the identical markup straight into the screen.
   * Nothing else differs between the two runs, which is what makes any
   * difference on screen attributable to it.
   */
  hosted: boolean;
  setHosted: (hosted: boolean) => void;
  /**
   * The page's own copy. This route renders outside the shell, so it has no
   * ShellIntlProvider to read from and is handed its language by the server
   * component instead.
   */
  copy: LayerCopy;
}

const LayerCaseContext = createContext<LayerCase | null>(null);

export function useLayerCase(): LayerCase {
  const value = useContext(LayerCaseContext);
  if (!value) throw new Error("useLayerCase must be used inside the layering case");
  return value;
}

export default LayerCaseContext;

"use client";

import { createContext, useContext } from "react";

// What a mini app instance demonstrates. One app, four lessons: the same two
// screens, with only the piece under discussion switched on.
export interface MiniConfig {
  // The screen transition carrying the push. Registered presets only.
  transition: "cupertino" | "material" | "layout";
  // Pair the list thumbnail and the detail hero with one <Morph layoutId>.
  morph: boolean;
  // Render a shared top bar whose title and action hand over as <Part>s.
  part: boolean;
}

export const DEFAULT_MINI: MiniConfig = { transition: "cupertino", morph: false, part: false };

const MiniContext = createContext<MiniConfig>(DEFAULT_MINI);

export const useMini = () => useContext(MiniContext);

export default MiniContext;

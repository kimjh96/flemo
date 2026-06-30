"use client";

import { createContext, useContext, useState, type PropsWithChildren } from "react";

// The transitions the control bar exposes. Each is a valid flemo TransitionName:
// cupertino/material/none are built in; the rest are authored in this app.
export type LabTransition =
  | "cupertino"
  | "material"
  | "blur"
  | "reveal"
  | "dive"
  | "ripple"
  | "card-stack"
  | "spring"
  | "fade"
  | "zoom"
  | "none";

interface LabSettings {
  transition: LabTransition;
  setTransition: (next: LabTransition) => void;
}

const LabSettingsContext = createContext<LabSettings | null>(null);

// Shares the chosen transition between the control bar and the stage, which sit
// on either side of the nested Router (context crosses it). The panel depth is
// read from the route (usePathname), not tracked here, so the two never drift.
function LabSettingsProvider({ children }: PropsWithChildren) {
  const [transition, setTransition] = useState<LabTransition>("cupertino");

  return (
    <LabSettingsContext.Provider value={{ transition, setTransition }}>
      {children}
    </LabSettingsContext.Provider>
  );
}

export function useLabSettings() {
  const context = useContext(LabSettingsContext);
  if (!context) throw new Error("useLabSettings must be used within LabSettingsProvider");
  return context;
}

export default LabSettingsProvider;

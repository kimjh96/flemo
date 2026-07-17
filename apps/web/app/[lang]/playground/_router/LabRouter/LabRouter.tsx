"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import LabTapMarker from "../../_components/LabTapMarker";
import HeavyScreen from "../../_screens/HeavyScreen";
import LabPanelsScreen from "../../_screens/LabPanelsScreen";
import StressLabScreen from "../../_screens/StressLabScreen";
import labFade from "../../_transitions/labFade";
import stressEntry from "../../_transitions/stressEntry";

import "./LabRouter.types";

export interface LabRouterProps {
  // Seeded from the shell's matched panel number (PlaygroundScreen), so the
  // server and client agree on the first screen even on a deep link.
  initPath: string;
}

// The playground stage's OUTER Router: it navigates between the panel browser
// (LabPanelsScreen — a nested Router with the floating control dock as its
// persistent chrome) and the full-bleed lab screens (stress lab, heavy
// fixture). Splitting the levels gives the dock both behaviors for free: panel
// moves happen INSIDE the panels screen, so the dock holds still over them,
// while a push to the stress lab transitions the whole panels screen — dock
// included — out of the stage. Registers `fade` (the stress lab offers it) and
// the stressEntry part transition that sinks the dock's stress-lab entry row
// as the panels screen recedes.
function LabRouter({ initPath }: LabRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      transitions={[labFade]}
      partTransitions={[stressEntry]}
      className="relative h-full w-full bg-[var(--color-bg)]"
    >
      <Slot className="h-full w-full">
        {/* The static heavy + stress routes win over the panels catch-all
            because the Renderer takes the first matching Route in order. Both
            are reached under the shell's `/playground/:n` catch-all so deep
            links resolve on the server. */}
        <Route path="/playground/heavy" element={<HeavyScreen />} />
        <Route path="/playground/stress" element={<StressLabScreen />} />
        <Route path={["/playground", "/playground/:n"]} element={<LabPanelsScreen />} />
      </Slot>
      {/* Hidden perception anchor for the stress lab (outside the <Slot> so it
          stays spatially still while the transition moves). */}
      <LabTapMarker />
    </Router>
  );
}

export default LabRouter;

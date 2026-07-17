"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import LabControls from "../../_components/LabControls";
import LabTapMarker from "../../_components/LabTapMarker";
import HeavyScreen from "../../_screens/HeavyScreen";
import LabPanelScreen from "../../_screens/LabPanelScreen";
import StressLabScreen from "../../_screens/StressLabScreen";
import blur from "../../_transitions/blur";
import cardStack from "../../_transitions/cardStack";
import dive, { tunnel } from "../../_transitions/dive";
import labFade from "../../_transitions/labFade";
import labZoom from "../../_transitions/labZoom";
import reveal from "../../_transitions/reveal";
import ripple, { ripples } from "../../_transitions/ripple";
import panelTitle from "../../_transitions/panelTitle";
import spring from "../../_transitions/spring";
import tabForward from "../../_transitions/tabForward";
import wipe from "../../_transitions/wipe";

import "./LabRouter.types";

export interface LabRouterProps {
  // Seeded from the shell's matched panel number (PlaygroundScreen), so the
  // server and client agree on the first panel even on a deep link.
  initPath: string;
}

// The full-page playground stage: a nested Router whose single panel route fills
// the area, with the floating control bar pinned over it (outside the Slot, so
// it persists across every transition). Registers the custom transitions the
// bar can pick (blur, reveal, dive, ripple, ...); cupertino/material/none are
// built in. dive and ripple also carry decorators (the tunnel vignette and the
// water ripples between the screens).
function LabRouter({ initPath }: LabRouterProps) {
  const getLocale = useShellLocaleGetter();

  return (
    <Router
      initPath={initPath}
      createDriver={(key) => createLocaleHistoryDriver(key, getLocale)}
      transitions={[
        labFade,
        labZoom,
        blur,
        reveal,
        dive,
        ripple,
        cardStack,
        spring,
        wipe,
        tabForward
      ]}
      partTransitions={[panelTitle]}
      decorators={[tunnel, ripples]}
      className="relative h-full w-full bg-[var(--color-bg)]"
    >
      <Slot className="h-full w-full">
        {/* The static heavy + stress routes win over `/playground/:n` because the
            Renderer takes the first matching Route in order. `stress` is the
            stress lab entry (its controls run the `heavy` fixture); both are
            reached under the shell's `/playground/:n` catch-all so deep links
            resolve on the server. */}
        <Route path="/playground/heavy" element={<HeavyScreen />} />
        <Route path="/playground/stress" element={<StressLabScreen />} />
        <Route path="/playground/:n" element={<LabPanelScreen />} />
      </Slot>
      <LabControls />
      {/* Hidden perception anchor for the stress lab (outside the <Slot> so it
          stays spatially still while the transition moves). */}
      <LabTapMarker />
    </Router>
  );
}

export default LabRouter;

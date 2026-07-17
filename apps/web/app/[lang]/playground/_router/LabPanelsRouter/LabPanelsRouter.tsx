"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import LabControls from "../../_components/LabControls";
import LabPanelScreen from "../../_screens/LabPanelScreen";
import blur from "../../_transitions/blur";
import cardStack from "../../_transitions/cardStack";
import dive, { tunnel } from "../../_transitions/dive";
import labFade from "../../_transitions/labFade";
import labZoom from "../../_transitions/labZoom";
import panelTitle from "../../_transitions/panelTitle";
import reveal from "../../_transitions/reveal";
import ripple, { ripples } from "../../_transitions/ripple";
import spring from "../../_transitions/spring";
import tabForward from "../../_transitions/tabForward";
import wipe from "../../_transitions/wipe";

export interface LabPanelsRouterProps {
  // Seeded from the outer Router's matched panel number (LabPanelsScreen), so
  // a deep link renders the right panel on both server and client.
  initPath: string;
  // Pushes the stress lab on the OUTER lab Router: the stress route lives one
  // level above this panels sub-app, so the whole panels screen (dock included)
  // rides that transition out.
  onOpenStressLab: () => void;
}

// The panel browser: a nested Router whose single panel route fills the stage,
// with the floating control dock pinned over it (outside the Slot, so it
// persists across every panel transition). Registers the custom transitions the
// dock can pick (blur, reveal, dive, ripple, ...); cupertino/material/none are
// built in. dive and ripple also carry decorators (the tunnel vignette and the
// water ripples between the screens); panelTitle drifts the panel title inside
// its screen.
function LabPanelsRouter({ initPath, onOpenStressLab }: LabPanelsRouterProps) {
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
      className="relative h-full w-full"
    >
      <Slot className="h-full w-full">
        <Route path="/playground/:n" element={<LabPanelScreen />} />
      </Slot>
      <LabControls onOpenStressLab={onOpenStressLab} />
    </Router>
  );
}

export default LabPanelsRouter;

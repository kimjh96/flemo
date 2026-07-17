"use client";

import { Route, Router, Slot } from "@flemo/react";

import { useShellLocaleGetter } from "@/app/[lang]/_providers/ShellIntlProvider";
import createLocaleHistoryDriver from "@/lib/localeHistoryDriver";

import LabControls from "../../_components/LabControls";
import LabSpikeHarness from "../../_components/LabSpikeHarness";
import HeavyScreen from "../../_screens/HeavyScreen";
import LabPanelScreen from "../../_screens/LabPanelScreen";
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
        {/* SPIKE fixture: the static heavy route wins over `/playground/:n`
            because the Renderer takes the first matching Route in order. */}
        <Route path="/playground/heavy" element={<HeavyScreen />} />
        <Route path="/playground/:n" element={<LabPanelScreen />} />
      </Slot>
      <LabControls />
      <LabSpikeHarness />
    </Router>
  );
}

export default LabRouter;

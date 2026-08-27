"use client";

import { useState } from "react";

import { Route, Router, Screen, Slot } from "@flemo/react";

import LayerTabBar from "../../_components/LayerTabBar";
import LayerCaseContext from "../../_providers/LayerCaseContext";

import LayerStepScreen from "../../_screens/LayerStepScreen";

import "./LayerRouter.types";

// The arrangement the whole class is about, and the one no repository fixture
// had: an OUTER screen owns the shared bar and declares nothing else, and the
// transitions happen in a Router mounted inside it. The bar is therefore
// chrome the inner screens do not own — which is exactly what a `position:
// fixed` overlay written inside one of them cannot reach past.
//
// Shiflo's home tab is this shape, and it is the reason a per-screen host is
// not enough: an inner screen's own container is already one box inside the
// outer scope, below a bar declared outside it.
function LayerRegion() {
  return (
    <Router
      name="layer-region"
      initPath="/playground/layer/a"
      history="memory"
      defaultTransitionName="cupertino"
      className="h-full w-full"
    >
      <Slot className="h-full w-full">
        <Route path="/playground/layer/a" element={<LayerStepScreen step="A" />} />
        <Route path="/playground/layer/b" element={<LayerStepScreen step="B" />} />
      </Slot>
    </Router>
  );
}

// Where an OUTER push lands. Flat grey and unremarkable: its whole job is to
// be a new region arriving over the old one, so the question it answers —
// does an open sheet end up under it — needs nothing else on it.
function LayerAwayScreen() {
  return (
    <Screen backgroundColor="#3a3a3a" hideStatusBar>
      <div
        data-layer-away=""
        className="flex h-full w-full items-center justify-center text-[96px] leading-none font-black text-white"
      >
        OUT
      </div>
    </Screen>
  );
}

function LayerRouter() {
  const [openOn, setOpenOn] = useState<"A" | "B" | null>(null);
  const [hosted, setHosted] = useState(true);

  return (
    // Above BOTH Routers, so neither a step nor an outer push resets the case.
    <LayerCaseContext.Provider value={{ openOn, setOpenOn, hosted, setHosted }}>
      <Router
        name="layer-shell"
        initPath="/playground/layer"
        history="memory"
        defaultTransitionName="cupertino"
        className="h-full w-full"
      >
        <Slot className="h-full w-full">
          <Route
            path="/playground/layer"
            element={
              <Screen
                sharedBottomBar={<LayerTabBar />}
                sharedBottomBarId="layer-chrome"
                // Without a height the bar wrapper has no `bottom` to resolve
                // against and falls back to its static position, which is the
                // TOP of the screen. A real app passes the device inset.
                systemNavigationBarHeight="0px"
                hideStatusBar
              >
                <LayerRegion />
              </Screen>
            }
          />
          <Route path="/playground/layer/away" element={<LayerAwayScreen />} />
        </Slot>
      </Router>
    </LayerCaseContext.Provider>
  );
}

export default LayerRouter;

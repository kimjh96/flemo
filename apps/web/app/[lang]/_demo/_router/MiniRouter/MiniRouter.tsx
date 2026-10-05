"use client";

import { Route, Router, Slot } from "@flemo/react";

import MiniAutoplay from "../../_components/MiniAutoplay";
import MiniDetailScreen from "../../_screens/MiniDetailScreen";
import MiniListScreen from "../../_screens/MiniListScreen";
import miniBarParts from "../../_transitions/miniBar";
import MiniContext, { type MiniConfig } from "../../_providers/MiniContext";

import "./MiniRouter.types";

export interface MiniRouterProps {
  config: MiniConfig;
  autoplay: boolean;
}

// The small "Places" app every live demo on the site runs: a list and a detail,
// in a nested Router with memory history. The config switches on exactly the
// piece a demo is about (a preset, a Morph, a shared bar with Parts) and
// nothing else, so each demo shows one idea.
//
// The autoplayer is a non-Route child, so the routes sit in a <Slot>.
function MiniRouter({ config, autoplay }: MiniRouterProps) {
  return (
    <MiniContext.Provider value={config}>
      <Router
        initPath="/mini"
        history="memory"
        defaultTransitionName={config.transition}
        partTransitions={miniBarParts}
        className="h-full w-full bg-bg"
      >
        <MiniAutoplay enabled={autoplay} />
        <Slot className="h-full w-full">
          <Route path="/mini" element={<MiniListScreen />} />
          <Route path="/mini/:id" element={<MiniDetailScreen />} />
        </Slot>
      </Router>
    </MiniContext.Provider>
  );
}

export default MiniRouter;

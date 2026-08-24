"use client";

import { Route, Router, Slot } from "@flemo/react";

import detailContent from "../../_transitions/detailContent";
import drift from "../../_transitions/drift";
import fade from "../../_transitions/fade";
import raise from "../../_transitions/raise";
import sheet from "../../_transitions/sheet";

import GalleryScreen from "../../_screens/GalleryScreen";
import PieceScreen from "../../_screens/PieceScreen";

import TransitionChoiceContext, {
  type PlaygroundChoice
} from "../../_providers/TransitionChoiceContext";

import "./PlaygroundRouter.types";

// Every consumer-authored transition the catalog offers. The built-in presets
// need no registration — flemo ships them — which is itself the difference the
// bench is showing.
const TRANSITIONS = [sheet, drift, fade, raise];
const PART_TRANSITIONS = [detailContent];

export interface PlaygroundRouterProps {
  choice: PlaygroundChoice;
}

// A memory Router so the fixture never touches the page URL: the site's shell
// already drives that, and a second browser-history Router on the same document
// would be arguing with it.
function PlaygroundRouter({ choice }: PlaygroundRouterProps) {
  return (
    <TransitionChoiceContext.Provider value={choice}>
      <Router
        initPath="/playground/gallery"
        history="memory"
        transitions={TRANSITIONS}
        partTransitions={PART_TRANSITIONS}
        defaultTransitionName={choice.transition.id}
        className="h-full w-full bg-[var(--color-bg)]"
      >
        <Slot className="h-full w-full">
          <Route path="/playground/gallery" element={<GalleryScreen />} />
          <Route path="/playground/gallery/:id" element={<PieceScreen />} />
        </Slot>
      </Router>
    </TransitionChoiceContext.Provider>
  );
}

export default PlaygroundRouter;

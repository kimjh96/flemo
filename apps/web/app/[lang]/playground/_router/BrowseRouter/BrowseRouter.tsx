"use client";

import { Route, Router, Slot } from "@flemo/react";

import StackReporter from "../../_components/StackReporter";

import BAR_PARTS from "../../_transitions/barContent";
import BODY_PARTS from "../../_transitions/bodyContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";

import ActScreen from "../../_screens/ActScreen";
import ActsScreen from "../../_screens/ActsScreen";

import "../TonightRouter/TonightRouter.types";

const TRANSITIONS = [fade, sheet];
// Every generated part, registered together. They are generated per screen
// transition (see `clocks.ts`), so registering the whole set is what guarantees
// the bench cannot select a transition whose parts are missing.
const PART_TRANSITIONS = [...BAR_PARTS, ...BODY_PARTS];

// THE NESTED ROUTER: a stack of its own, inside one screen of the app's stack.
//
// `history="memory"` because the browser's URL belongs to the site around it.
//
// `name` is set so a screen in here can aim a push one level UP with
// `router: "parent"` — the seat map does exactly that, and it is the difference
// between a screen that hides the tab bar and a screen at a level where the tab
// bar does not exist.
function BrowseRouter() {
  return (
    <Router
      name="browse"
      initPath="/browse/acts"
      history="memory"
      transitions={TRANSITIONS}
      partTransitions={PART_TRANSITIONS}
      defaultTransitionName="cupertino"
      className="h-full w-full"
    >
      <Slot className="h-full w-full">
        <Route path="/browse/acts" element={<ActsScreen />} />
        <Route path="/browse/act/:id" element={<ActScreen />} />
      </Slot>
      <StackReporter scope="browse" />
    </Router>
  );
}

export default BrowseRouter;

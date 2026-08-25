"use client";

import { Route, Router, Slot } from "@flemo/react";

import StackReadout from "../../_components/StackReadout";

import detailContent from "../../_transitions/detailContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";
import stepContent from "../../_transitions/stepContent";

import ListScreen from "../../_screens/ListScreen";
import PieceScreen from "../../_screens/PieceScreen";
import ViewerScreen from "../../_screens/ViewerScreen";

import "../AppRouter/AppRouter.types";

const TRANSITIONS = [sheet, fade];
const PART_TRANSITIONS = [detailContent, stepContent];

// THE NESTED ROUTER: a stack of its own, inside one screen of the app's stack.
//
// This is the shape a real app has, and the one a single Router cannot show. A
// push in here deepens THIS stack; the tab bar underneath it belongs to the
// outer Router and never hears about it, which is exactly why the bar does not
// flicker when you open a piece. The two readouts under the frame are the same
// component pointed at the two scopes, so the difference is visible rather than
// asserted.
//
// `history="memory"` because the browser's URL belongs to the site around it.
// The outer fixture Router is memory for the same reason.
function BrowseRouter() {
  return (
    <Router
      initPath="/browse/list"
      history="memory"
      transitions={TRANSITIONS}
      partTransitions={PART_TRANSITIONS}
      defaultTransitionName="fade"
      className="h-full w-full"
    >
      <div className="flex h-full w-full flex-col">
        <Slot className="min-h-0 flex-1">
          <Route path="/browse/list" element={<ListScreen />} />
          <Route path="/browse/piece/:id" element={<PieceScreen />} />
          <Route path="/browse/viewer/:id" element={<ViewerScreen />} />
        </Slot>
        <StackReadout label="inner" />
      </div>
    </Router>
  );
}

export default BrowseRouter;

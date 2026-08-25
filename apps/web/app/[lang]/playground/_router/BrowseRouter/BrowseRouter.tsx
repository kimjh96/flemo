"use client";

import { Route, Router, Slot } from "@flemo/react";

import BrowseHeader from "../../_components/BrowseHeader";
import StackReadout from "../../_components/StackReadout";

import detailContent from "../../_transitions/detailContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";
import stepContent from "../../_transitions/stepContent";

import ListScreen from "../../_screens/ListScreen";
import PieceScreen from "../../_screens/PieceScreen";

import "../AppRouter/AppRouter.types";

const TRANSITIONS = [sheet, fade];
const PART_TRANSITIONS = [detailContent, stepContent];

// THE NESTED ROUTER, and the level that owns the header.
//
// Everything about "the header stays" is decided here, by structure: the
// header is rendered BESIDE the <Slot>, so the screens inside it transition and
// it does not. There is no bar to hand over, no id to match, and nothing to
// cross-fade — a navigation cannot move a thing it does not contain.
//
// The same structure decides the other half. A screen that must escape this
// header does not ask for a different bar: it is pushed on the PARENT Router,
// where this Slot is not, and the whole region including the header goes with
// its own transition. That is what `router: "parent"` on the piece screen does,
// and why `name` is set here and on the app.
//
// `history="memory"` because the browser's URL belongs to the site around it.
function BrowseRouter() {
  return (
    <Router
      name="browse"
      initPath="/browse/list"
      history="memory"
      transitions={TRANSITIONS}
      partTransitions={PART_TRANSITIONS}
      defaultTransitionName="fade"
      className="h-full w-full"
    >
      <div className="flex h-full w-full flex-col">
        <BrowseHeader />
        <Slot className="min-h-0 flex-1">
          <Route path="/browse/list" element={<ListScreen />} />
          <Route path="/browse/piece/:id" element={<PieceScreen />} />
        </Slot>
        <StackReadout label="browse" />
      </div>
    </Router>
  );
}

export default BrowseRouter;

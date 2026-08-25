"use client";

import { Route, Router, Slot } from "@flemo/react";

import StackReadout from "../../_components/StackReadout";

import barContent from "../../_transitions/barContent";
import detailContent from "../../_transitions/detailContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";
import stepContent from "../../_transitions/stepContent";

import ListScreen from "../../_screens/ListScreen";
import PieceScreen from "../../_screens/PieceScreen";

import "../AppRouter/AppRouter.types";

const TRANSITIONS = [sheet, fade];
const PART_TRANSITIONS = [barContent, detailContent, stepContent];

// THE NESTED ROUTER: a stack of its own, inside one screen of the app's stack.
//
// Two kinds of chrome, and the difference between them is which side of the
// <Slot> they are on.
//
// The app bar is a SHARED bar: the screens hand the same one up under one id,
// so its box is kept out of the transition while its contents move with the
// flight (see AppBar). The readout below is chrome of this Router, outside the
// Slot entirely, so a navigation cannot touch it at all.
//
// And a screen that must escape both is not a screen with different bars: it is
// a screen at a different LEVEL, pushed on the parent with `router: "parent"`,
// where this Slot is not. That is why `name` is set here and on the app.
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

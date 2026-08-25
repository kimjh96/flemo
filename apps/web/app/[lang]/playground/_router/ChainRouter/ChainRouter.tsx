"use client";

import { Route, Router, Screen, Slot } from "@flemo/react";

import detailContent from "../../_transitions/detailContent";
import fade from "../../_transitions/fade";
import stepContent from "../../_transitions/stepContent";
import sheet from "../../_transitions/sheet";

import StackReadout from "../../_components/StackReadout";
import StepRail from "../../_components/StepRail";

import ChainScreen from "../../_screens/ChainScreen";

import "./ChainRouter.types";

const TRANSITIONS = [sheet, fade];
const PART_TRANSITIONS = [detailContent, stepContent];

// A second memory Router, independent of the strip above: the point of this one
// is the STACK, not any single transition.
//
// It is deliberately NESTED — mounted inside a screen of an outer Router — so
// the chain covers the other axis as well. A nested Router contains its screens
// (and its flight layer) to its own positioned, clipping box rather than to the
// page, which is a different arrangement for every part of a morph: the layer's
// coordinates, the camera's anchor, and what clips a flight in progress.
function ChainStack() {
  return (
    <Router
      initPath="/playground/chain/start"
      history="memory"
      transitions={TRANSITIONS}
      partTransitions={PART_TRANSITIONS}
      defaultTransitionName="cupertino"
      className="h-full w-full bg-[var(--color-bg)]"
    >
      {/* Chrome beside the stack, exactly like the browse bench's header: the
          rail must not travel with the screens, so it does not live among
          them. It reads the history store, so it cannot drift out of step with
          what the pops actually did. */}
      <div className="flex h-full w-full flex-col">
        <StepRail />
        <Slot className="min-h-0 flex-1">
          <Route path="/playground/chain/:step" element={<ChainScreen />} />
        </Slot>
        <StackReadout label="chain" />
      </div>
    </Router>
  );
}

function ChainRouter() {
  return (
    <Router
      initPath="/playground/nest"
      history="memory"
      defaultTransitionName="none"
      className="h-full w-full"
    >
      <Slot className="h-full w-full">
        <Route
          path="/playground/nest"
          element={
            <Screen statusBarHeight="0px" systemNavigationBarHeight="0px">
              <ChainStack />
            </Screen>
          }
        />
      </Slot>
    </Router>
  );
}

export default ChainRouter;

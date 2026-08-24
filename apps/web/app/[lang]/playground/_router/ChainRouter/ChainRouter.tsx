"use client";

import { Route, Router, Screen, Slot } from "@flemo/react";

import detailContent from "../../_transitions/detailContent";
import drift from "../../_transitions/drift";
import sheet from "../../_transitions/sheet";

import ChainScreen from "../../_screens/ChainScreen";

import "./ChainRouter.types";

const TRANSITIONS = [sheet, drift];
const PART_TRANSITIONS = [detailContent];

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
      <Slot className="h-full w-full">
        <Route path="/playground/chain/:step" element={<ChainScreen />} />
      </Slot>
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
            <Screen>
              <ChainStack />
            </Screen>
          }
        />
      </Slot>
    </Router>
  );
}

export default ChainRouter;

"use client";

import { Route, Router, Slot } from "@flemo/react";

import StackReporter from "../../_components/StackReporter";

import BAR_PARTS from "../../_transitions/barContent";
import BODY_PARTS from "../../_transitions/bodyContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";

import HomeTabScreen from "../../_screens/HomeTabScreen";
import SeatMapScreen from "../../_screens/SeatMapScreen";
import TicketsScreen from "../../_screens/TicketsScreen";

import MotionChoiceContext, { type MotionChoice } from "../../_providers/MotionChoiceContext";

import "./TonightRouter.types";

const TRANSITIONS = [fade, sheet];
const PART_TRANSITIONS = [...BAR_PARTS, ...BODY_PARTS];

export interface TonightRouterProps {
  choice: MotionChoice;
}

// THE APP, one Router deep, with a second one inside it.
//
// The composition is the point, and none of it is a feature laid out beside
// another feature:
//
//   the tab bar is a SHARED bar declared by both TAB SCREENS — not by this
//   Router — so it holds perfectly still while the tabs cross-fade under it,
//   and so the seat map, which declares none, simply does not have one;
//
//   the Home tab is a screen that CONTAINS a Router, so a push in there
//   deepens a stack the tab bar knows nothing about;
//
//   the seat map is pushed one level UP, so the whole tab region leaves as one
//   thing with its own transition rather than hiding its bars one by one;
//
//   and both scopes report to the readout under the frame, which is what makes
//   "nested" something you watch rather than read.
//
// The bench's switches drive the INNER stack. A tab switch keeps its own fade,
// because a tab switch is not the thing being compared.
function TonightRouter({ choice }: TonightRouterProps) {
  return (
    <MotionChoiceContext.Provider value={choice}>
      <Router
        name="tonight"
        initPath="/tonight/home"
        history="memory"
        transitions={TRANSITIONS}
        partTransitions={PART_TRANSITIONS}
        defaultTransitionName="fade"
        className="h-full w-full bg-[var(--color-bg)]"
      >
        <Slot className="h-full w-full">
          <Route path="/tonight/home" element={<HomeTabScreen />} />
          <Route path="/tonight/tickets" element={<TicketsScreen />} />
          {/* A level ABOVE the tabs: no tab bar here, because the tab bar is
              not at this level. */}
          <Route path="/tonight/seatmap/:id" element={<SeatMapScreen />} />
        </Slot>
        <StackReporter scope="tonight" />
      </Router>
    </MotionChoiceContext.Provider>
  );
}

export default TonightRouter;

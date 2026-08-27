"use client";

import { Route, Router, Slot } from "@flemo/react";

import StackReporter from "../../_components/StackReporter";
import StepRail from "../../_components/StepRail";

import BAR_PARTS from "../../_transitions/barContent";
import BODY_PARTS from "../../_transitions/bodyContent";
import fade from "../../_transitions/fade";
import sheet from "../../_transitions/sheet";

import BookingScreen from "../../_screens/BookingScreen";

import "./BookingRouter.types";

const TRANSITIONS = [fade, sheet];
const PART_TRANSITIONS = [...BAR_PARTS, ...BODY_PARTS];

// The booking flow: five pushes, a different transition on each.
//
// The transitions case answers "does this transition work". This answers the
// question only a stack can — whether a flight leaves anything behind for the
// next one to trip on, and whether five pops unwind five different transitions
// in the right order.
//
// The progress rail is chrome of this Router, OUTSIDE the <Slot>, so it cannot
// travel with the screens. That is not decoration: a progress indicator that
// moves during the navigation it is describing is the clearest way to get this
// wrong, and putting it outside the Slot is how flemo says "not part of the
// flight" structurally rather than by opting out of an animation.
function BookingRouter() {
  return (
    <Router
      name="booking"
      initPath="/booking/tonight"
      history="memory"
      transitions={TRANSITIONS}
      partTransitions={PART_TRANSITIONS}
      defaultTransitionName="cupertino"
      className="h-full w-full bg-[var(--color-bg)]"
    >
      <div className="flex h-full w-full flex-col">
        <StepRail />
        <Slot className="min-h-0 flex-1">
          <Route path="/booking/:step" element={<BookingScreen />} />
        </Slot>
      </div>
      <StackReporter scope="booking" />
    </Router>
  );
}

export default BookingRouter;

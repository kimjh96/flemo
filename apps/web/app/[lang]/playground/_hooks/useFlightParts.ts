"use client";

import { useHistoryStore, useScreen } from "@flemo/react";

import { barPartFor, bodyPartFor, clockFor, type Beat } from "../_transitions/clocks";

export interface FlightParts {
  /** The transition currently carrying this scope. */
  transitionName: string;
  /** The shared bar's contents, on the flight's clock. */
  barPart: string;
  /** The screen's own content, on the flight's clock. */
  bodyPart: string;
}

// WHICH TRANSITION IS FLYING — asked of flemo rather than worked out here.
//
// This is the correction the second round of this rebuild turned on. The
// booking flow gives every step its own transition, so `BookingScreen` looked
// its own step up in the table and asked for that transition's parts. During a
// flight there are TWO screens on screen with two different step transitions,
// so each authored its chrome on a different clock: the root step is `none`, at
// zero seconds, which is why its title vanished instantly while the arriving
// one faded in over cupertino's 0.7s.
//
// flemo already publishes the right answer. `createScreenSelector` overwrites
// every mounted screen's `transitionName` with the ACTIVE TOP'S, and says so:
//
//   `transitionName` is the active top's (every screen in a transition shares it)
//
// So every screen in one flight reports the same name, which is the definition
// of the flight's clock. Reading it is both simpler than a lookup and correct
// in the case the lookup got wrong.
export function useFlightParts(): FlightParts {
  const { transitionName } = useScreen();

  return {
    transitionName,
    barPart: barPartFor(transitionName),
    bodyPart: bodyPartFor(transitionName)
  };
}

// The flight's TIMING, for chrome that cannot be a <Part>.
//
// `<Part>` resolves its status from the enclosing SCREEN's owner — a part in a
// nested Router's chrome deliberately belongs to the outer flight. The whole
// playground is one screen of the site's Router, so a Part beside a nested
// <Slot> reports the shell's state and never moves: measured at 0s while its
// screens ran 0.7s. Chrome in that position has to carry the clock itself.
//
// It reads the history store rather than `useScreen()`, which out here returns
// its default with a constant `transitionName: "none"` — a zero clock, and the
// snap this exists to remove. The store is the same source `createScreenSelector`
// reads, so the answer matches the one the screens got.
export function useFlightBeat(): Beat {
  const transitionName = useHistoryStore(
    (state) => state.histories[state.index]?.transitionName ?? "none"
  );

  // The push beat: chrome describes where the stack now IS, and a pop settles
  // it to the same place. Only material distinguishes the two, and taking the
  // longer of its beats keeps the rail from finishing ahead of the screens.
  return clockFor(transitionName).push;
}

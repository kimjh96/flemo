"use client";

import { useEffect } from "react";

// THE INSTRUMENT IS ALREADY IN THIS REPOSITORY.
//
// `@flemo/devtools` is a flight recorder plus a panel, written as "a PURE
// CONSUMER of surfaces flemo already exposes". It derives, per flight: player
// and main-thread frame gaps, long tasks overlapping the visible-motion start
// ("opening-swallow risk: the first presented frames of the transition may have
// been lost"), holds re-asserted after release, `playState=paused` after
// release, frames that "advanced neither the animation clock nor the pose",
// images finishing their decode mid-flight unheld, orphaned hold markers,
// residual inline transforms after COMPLETED, screens resting at their
// from-pose, and stuck transitional statuses.
//
// It also ships the JUDGING PROTOCOL and the BLIND SPOTS in every report, which
// is the part that matters most here:
//
//   judging.ts
//     "a verdict taken outside this protocol is not evidence"
//     "No screen recording or display capture while judging. A capture client
//      forces WindowServer to composite every vsync, which SUPPRESSES the
//      symptom -- a capture that looks smooth proves nothing about the
//      uncaptured session."
//     "Judge with real input (a finger, a mouse). Synthetic dispatch --
//      evaluate().click() and friends -- never fires pointerdown, so it
//      bypasses the swipe/gesture machinery."
//
// One detail this corrects: visible motion starts at the HOLD RELEASE, not the
// status flip, because "the engine absorbs heavy commits INTO the hold on
// purpose". Any measurement keyed on the flip is measuring the wrong window.
//
// The package's `production` export condition resolves to `noop.mjs`, so a
// production build carries none of this and judging a production build with the
// panel wired costs nothing.
//
// THE READOUT IS MOUNTED TOO, and it is the half that matters on a phone. A
// device has no console, and every device round in this project's history began
// by hand-building a box that prints numbers on the screen and deleting it when
// the round was over. `attachDevtoolsHud` is that box, kept: one line the user
// can photograph, a tap for the detail, a long press to cycle the A/B bucket.
// It repaints only between flights and its stylesheet carries no animation, so
// it cannot become the artifact it is measuring.
function DevtoolsPanel() {
  useEffect(() => {
    let detachPanel: (() => void) | undefined;
    let detachHud: (() => void) | undefined;
    let cancelled = false;

    // Imported lazily so the recorder never enters the server bundle and never
    // delays the page's own first paint.
    void import("@flemo/devtools").then(({ attachDevtoolsPanel, attachDevtoolsHud }) => {
      if (cancelled) return;
      detachPanel = attachDevtoolsPanel({ position: "bottom-left" }).detach;
      // Top, so it never sits over the stage's own landing area.
      detachHud = attachDevtoolsHud({ position: "top" }).detach;
    });

    return () => {
      cancelled = true;
      detachHud?.();
      detachPanel?.();
    };
  }, []);

  return null;
}

export default DevtoolsPanel;

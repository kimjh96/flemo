"use client";

import { FlemoDevtools } from "@flemo/devtools/react";

// THE INSTRUMENT IS ALREADY IN THIS REPOSITORY, and this is all it takes to
// mount it.
//
// `@flemo/devtools` is a flight recorder plus a panel and an on-device readout,
// written as "a PURE CONSUMER of surfaces flemo already exposes". It derives,
// per flight: main-thread frame gaps, long tasks overlapping the visible-motion
// start ("opening-swallow risk: the first presented frames of the transition may
// have been lost"), holds re-asserted after release, `playState=paused` after
// release, frames that "advanced neither the animation clock nor the pose",
// images finishing their decode mid-flight unheld, shared elements that never
// paired, one-frame events the browser reported, orphaned hold markers,
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
// NOTHING GUARDS THIS, and that is the point. `@flemo/devtools/react` resolves
// to a component that renders null under the `production` export condition, so
// the element can sit in the tree and ship: the recorder, the panel and the
// readout never enter a production graph. The site's own e2e asserts that the
// built output stays clean, because this file previously wired the surfaces by
// hand and put the real panel into a public chunk doing it.
function DevtoolsPanel() {
  return <FlemoDevtools />;
}

export default DevtoolsPanel;

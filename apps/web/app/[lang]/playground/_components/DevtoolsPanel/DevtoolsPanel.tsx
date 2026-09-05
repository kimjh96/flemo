"use client";

import { useEffect } from "react";

// THE INSTRUMENT IS ALREADY IN THIS REPOSITORY.
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
// ARMED, NOT ALWAYS ON -- and that is the whole reason this file is not two
// lines. The package's `production` export condition resolves to `noop.mjs`, so
// a plain import of it in a `next build` is INERT: the panel never mounts and
// the readout never appears. That is exactly right for a visitor and exactly
// wrong for the one session that needs it, because the judging protocol also
// says to judge a PRODUCTION build. Wired the plain way, the instrument existed
// only where its own protocol says its numbers do not count.
//
// So nothing loads by default, and `?devtools=on` loads `@flemo/devtools/force`,
// which is the entry that always carries the real implementation. The choice
// persists in `flemo:devtools` (sessionStorage), the key the package's own flag
// registry declares for it, so a device round survives the navigations it is
// there to measure; `?devtools=off` clears it. A session that never asks pays
// nothing: the dynamic import is never reached.
const ARM_KEY = "flemo:devtools";

const armed = (): boolean => {
  try {
    const wanted = new URLSearchParams(window.location.search).get("devtools");
    if (wanted === "on") sessionStorage.setItem(ARM_KEY, "on");
    if (wanted === "off") sessionStorage.removeItem(ARM_KEY);
    return sessionStorage.getItem(ARM_KEY) === "on";
  } catch {
    // Storage denied (private mode, partitioned iframe): fall back to the URL
    // alone, so one navigation can still arm it.
    return new URLSearchParams(window.location.search).get("devtools") === "on";
  }
};

function DevtoolsPanel() {
  useEffect(() => {
    if (!armed()) return;

    let detachPanel: (() => void) | undefined;
    let detachHud: (() => void) | undefined;
    let cancelled = false;

    // Imported lazily so the recorder never enters the server bundle and never
    // delays the page's own first paint.
    //
    // THE READOUT IS THE HALF THAT MATTERS ON A PHONE. A device has no console,
    // and every device round in this project's history began by hand-building a
    // box that prints numbers on the screen and deleting it when the round was
    // over. `attachDevtoolsHud` is that box, kept: one line the user can
    // photograph, a tap for the detail, a long press to cycle the A/B bucket.
    // It repaints only between flights and its stylesheet carries no animation,
    // so it cannot become the artifact it is measuring.
    void import("@flemo/devtools/force").then(({ attachDevtoolsPanel, attachDevtoolsHud }) => {
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

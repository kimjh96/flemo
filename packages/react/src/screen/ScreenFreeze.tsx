import { Activity, useEffect, useRef, useState, type ReactNode } from "react";

import { isDesktopBlink, type ScreenFreezeMode } from "@flemo/core";

interface ScreenFreezeProps {
  freeze: boolean;
  /**
   * WHY this screen is freezing, which decides whether the hide may wait.
   *
   * Only the JUST-COVERED screen can be re-revealed by a pop, so only its hide
   * can be the one a pop has to undo — and the debounce below exists for
   * exactly that round trip. A DEEP screen is never what a pop wakes, so
   * waiting buys it nothing and costs the thing the delay is invisible for
   * right up until it is not: for the length of the wait it is still PAINTING,
   * under whatever is on top of it.
   */
  mode?: ScreenFreezeMode;
  children: ReactNode;
}

// How long a covered screen stays LIVE at rest before the hide actually
// applies (steady-60 desktops). The hide/unhide pair is the expensive part of
// Activity for a large screen (an infinite-scroll list): hiding tears down its
// layers and raster, unhiding re-styles, re-lays-out and re-rasters the whole
// subtree. Glass-measured (2026-08-18): at the natural browse rhythm — detail
// for a second, then back — the push's hide landed ~170ms before the pop's
// unhide, and that overlapping thrash froze 8-12 consecutive pop frames.
// Debouncing the hide means a quick round-trip never freezes at all (the pop
// cancels the pending hide), while a genuine stay still freezes and reclaims
// memory once the user has settled.
const FREEZE_REST_DEBOUNCE_MS = 3000;

// An inactive screen is kept mounted so it preserves its DOM state — scroll
// position, form values, media playback — and restores instantly when shown
// again. React's <Activity> handles this: in "hidden" mode it hides the screen
// (display:none on its host nodes, so the DOM and its scroll offset survive) and
// unmounts its effects, then on "visible" it remounts the effects without losing
// that state. This replaces the manual display:none wrapper and frozen-children
// snapshot with React's built-in offscreen handling.
//
// TWO THINGS, ON TWO CLOCKS. A freeze does two jobs, and only one of them is
// expensive:
//
//   1. stop PAINTING the screen — cheap, and the only one that is visible;
//   2. RELEASE it — unmount its effect tree, drop its boxes, let the raster go.
//
// They were one commit, so the delay that job 2 needs was also delaying job 1:
// a covered screen went on painting for as long as the release was deferred,
// which on a desktop is three seconds. Nothing above it is obliged to be
// opaque, so that was three seconds of a stack showing through itself.
//
// Split, job 1 lands in the commit the screen is marked covered, on every
// platform — `visibility: hidden` on the screen container (ScreenMotion owns
// it; no wrapper is added here, because a node between a screen and its
// siblings is a node the swipe's previous-sibling walk has to climb) removes
// it from paint without removing its boxes or unmounting anything, so it
// cannot cause the re-layout half of the thrash the debounce was measured
// against. Job 2 — this module — keeps its clock. What the user sees is now
// uniform and immediate; what differs by platform is only when the memory
// comes back.
function ScreenFreeze({ freeze, mode = "deferred", children }: ScreenFreezeProps) {
  const [applied, setApplied] = useState(freeze);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // UNFREEZE is instant, in this very commit: the returning screen must be
  // visible in the same paint as its status flip (render-phase adjustment,
  // same pattern as ScreenMotion's hold release).
  if (!freeze && applied) setApplied(false);
  useEffect(() => {
    if (!freeze || applied) return undefined;
    // Freeze: immediate everywhere except a DESKTOP BLINK screen that a pop
    // could come back to, where the hide debounces past the browse-rhythm
    // window (see FREEZE_REST_DEBOUNCE_MS).
    //
    // A deep screen is not that screen. Screen.tsx already makes the same
    // distinction one stage earlier and says why in as many words — a rapid
    // push storm never offers a quiet window, so deferring the deep freezes
    // let 15-20 live full-screen layers accumulate — and then collapses the
    // mode to a boolean, which is how the argument stopped being made here.
    // The visible half of that: every screen in a stack kept painting for
    // three seconds after it was covered, so anything that made the screens
    // above it translucent showed the whole pile.
    //
    // The debounce trades MEMORY (one screen kept alive a few seconds longer)
    // for the hide/unhide raster thrash a quick detail-and-back otherwise pays
    // — an argument about what the machine can spare, not about its refresh
    // rate. It keyed on the steady-60 verdict until 2026-08-21 only because
    // that verdict once routed the driver and every desktop default hung off
    // it; a desktop pays the same raster either way, and no longer waits two
    // flights to stop paying it.
    if (mode === "immediate" || !isDesktopBlink()) {
      setApplied(true);
      return undefined;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      setApplied(true);
    }, FREEZE_REST_DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [freeze, applied, mode]);
  return <Activity mode={freeze && applied ? "hidden" : "visible"}>{children}</Activity>;
}

export default ScreenFreeze;

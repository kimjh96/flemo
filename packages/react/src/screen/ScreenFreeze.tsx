import { Activity, useEffect, useRef, useState, type ReactNode } from "react";

import { isDesktopBlink } from "@flemo/core";

interface ScreenFreezeProps {
  freeze: boolean;
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
function ScreenFreeze({ freeze, children }: ScreenFreezeProps) {
  const [applied, setApplied] = useState(freeze);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // UNFREEZE is instant, in this very commit: the returning screen must be
  // visible in the same paint as its status flip (render-phase adjustment,
  // same pattern as ScreenMotion's hold release).
  if (!freeze && applied) setApplied(false);
  useEffect(() => {
    if (!freeze || applied) return undefined;
    // Freeze: immediate everywhere except DESKTOP BLINK, where the hide
    // debounces past the browse-rhythm window (see FREEZE_REST_DEBOUNCE_MS).
    //
    // The debounce trades MEMORY (one screen kept alive a few seconds longer)
    // for the hide/unhide raster thrash a quick detail-and-back otherwise pays
    // — an argument about what the machine can spare, not about its refresh
    // rate. It keyed on the steady-60 verdict until 2026-08-21 only because
    // that verdict once routed the driver and every desktop default hung off
    // it; a desktop pays the same raster either way, and no longer waits two
    // flights to stop paying it.
    if (!isDesktopBlink()) {
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
  }, [freeze, applied]);
  return <Activity mode={freeze && applied ? "hidden" : "visible"}>{children}</Activity>;
}

export default ScreenFreeze;

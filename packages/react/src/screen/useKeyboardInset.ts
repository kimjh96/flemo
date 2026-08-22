import { useEffect, useState } from "react";

import { measureKeyboardInset, observeKeyboardInset } from "@flemo/core";

// Thin React binding: the measurement (rAF-coalesced, one observer app-wide)
// is @flemo/core's observeKeyboardInset; this hook only owns the reactive state
// and the effect lifecycle.
//
// Returns how many CSS pixels of the layout viewport the software keyboard
// covers — the offset a `position: fixed` element needs to sit ON the keyboard
// rather than behind it:
//
//     const keyboardInset = useKeyboardInset();
//     <div style={{ position: "fixed", bottom: keyboardInset }} />
//
// 0 means no keyboard (and a pinch-zoomed page, where the number cannot be
// derived — see the core module).
//
// The inset is re-measured on every viewport change, so a keyboard that CHANGES
// height while open — an emoji panel, a suggestion bar, a language switch —
// moves the pinned element with it.
//
// What the platform does not give is the keyboard's SLIDE. Measured on an
// iPhone: the page receives one already-final value ~150ms after focus, and is
// stalled for most of that window (a 139ms frame gap), so there is nothing to
// follow. The value is therefore applied as it arrives, with no easing of our
// own — an easing would start after the platform unfroze, when the keyboard is
// nearly up, and would land LATE. Add a transition only if you prefer softness
// over accuracy.
//
// An iPad floating or split keyboard does not shrink the visual viewport at
// all, so it reads 0; nothing in the platform exposes its frame.
export default function useKeyboardInset() {
  // Seeded from a direct measurement rather than 0: a screen that mounts while
  // the keyboard is already open (a push from a focused field) would otherwise
  // paint its pinned element behind the keyboard for one frame.
  const [keyboardInset, setKeyboardInset] = useState(() =>
    typeof window === "undefined" ? 0 : measureKeyboardInset()
  );

  useEffect(() => observeKeyboardInset(setKeyboardInset), []);

  return keyboardInset;
}

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

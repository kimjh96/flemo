import { useEffect, useState } from "react";

import { observeViewportScrollHeight } from "@flemo/core";

// Thin React binding: the visualViewport measurement (rAF-coalesced, shared
// app-wide baseline) is @flemo/core's observeViewportScrollHeight; this hook
// only owns the reactive state and the effect lifecycle.
export default function useViewportScrollHeight() {
  const [viewportScrollHeight, setViewportScrollHeight] = useState(0);
  const [changedViewportScrollHeight, setChangedViewportScrollHeight] = useState(0);

  useEffect(
    () =>
      observeViewportScrollHeight((newViewportScrollHeight, newChangedViewportScrollHeight) => {
        setChangedViewportScrollHeight(newChangedViewportScrollHeight);
        setViewportScrollHeight(newViewportScrollHeight);
      }),
    []
  );

  return { viewportScrollHeight, changedViewportScrollHeight };
}

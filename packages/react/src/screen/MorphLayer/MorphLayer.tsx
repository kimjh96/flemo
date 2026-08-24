import { useLayoutEffect, useRef } from "react";

import { registerMorphLayer, type FlemoStores } from "@flemo/core";

export interface MorphLayerProps {
  stores: FlemoStores;
}

// Where a shared element is staged while it travels.
//
// The element is moved here for the flight and moved back on landing, which is
// what frees it from its screen: a screen clips its descendants, covers what it
// replaces, and drags its contents along when the transition slides. The layer
// takes no pointer input and holds nothing at rest — it is an empty box until a
// morph needs somewhere to fly.
//
// It is ABSOLUTE, so it anchors to the app's own frame exactly like the screens
// do — `<Slot>` positions them the same way. A root Router's layer used to be
// FIXED to the viewport instead, on the reasoning that a root Router owns the
// screen. That is one deployment of a root Router, not the only one: mounted
// inside a bounded frame (a device preview, an embedded region, a modal) the
// viewport is not its box, and a flight staged against the viewport paints
// straight through the frame's rounded corners while every screen inside it
// stays clipped. Absolute makes the layer share whatever box, and whatever
// clip, the app gave its screens.
function MorphLayer({ stores }: MorphLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    registerMorphLayer(stores.navigate, ref.current);
    return () => registerMorphLayer(stores.navigate, null);
  }, [stores.navigate]);

  return (
    <div
      ref={ref}
      data-flemo-morph-layer=""
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none"
      }}
    />
  );
}

export default MorphLayer;

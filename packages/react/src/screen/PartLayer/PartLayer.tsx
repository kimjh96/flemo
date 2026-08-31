import { useLayoutEffect, useRef } from "react";

import { registerPartLayer, type FlemoStores } from "@flemo/core";

export interface PartLayerProps {
  stores: FlemoStores;
}

// Where a matched shared bar's `<Part>` elements are staged while they trade
// places.
//
// Two screens declaring the same `sharedTopBarId` each render their own copy of
// that bar. Neither bar moves — that is what makes the chrome appear to hand
// over — but each one lives inside its own screen container, and a screen
// container is an isolated stacking context carrying the screen's z-index. So
// the covered screen's parts run their cross-fade under the other screen's
// opaque surface, where nothing can see them. For the flight they come up here
// instead, and go back the moment it lands.
//
// It is ABSOLUTE for the same reason the morph layer is: it anchors to the
// app's own frame exactly like the screens do, so a Router mounted inside a
// bounded frame stages its parts inside that frame rather than against the
// viewport. It takes no pointer input and holds nothing at rest.
function PartLayer({ stores }: PartLayerProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    registerPartLayer(stores.navigate, ref.current);
    return () => registerPartLayer(stores.navigate, null);
  }, [stores.navigate]);

  return (
    <div
      ref={ref}
      data-flemo-part-layer=""
      // What is staged here is the COVERED side's copy: the outgoing close icon
      // while its partner's back chevron takes over. The bar the user is left
      // with is the other screen's, and it is in the tree unchanged — so the
      // travelling duplicate is announced by nobody, exactly like a morph's.
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none"
      }}
    />
  );
}

export default PartLayer;

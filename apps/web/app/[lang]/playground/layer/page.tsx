import type { Metadata } from "next";

import LayerRouter from "../_router/LayerRouter";

// The layering case gets its OWN full-viewport route rather than a card on the
// playground page.
//
// It has to. A `position: fixed` overlay means the viewport, and a stage frame
// inside a scrolling page only means the frame if the frame is transformed —
// at which point the fixture is measuring a transform it invented, in exactly
// the class of bug it exists to judge. Real geometry, no rounded corners, no
// shadow, no explanatory paragraph.
export const metadata: Metadata = {
  title: "Overlay layering",
  robots: { index: false, follow: false }
};

export default function LayerPage() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-black" data-layer-stage="">
      <LayerRouter />
    </main>
  );
}

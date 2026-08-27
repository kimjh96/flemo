"use client";

import { Layer } from "@flemo/react";

import { useLayerCase } from "../../_providers/LayerCaseContext";

// The sheet a consumer writes: `position: fixed`, on the floor, with a z-index
// that beats the bar's. The SAME markup goes out both ways — the only
// difference between the two runs is whether <Layer> wraps it — so anything
// that differs on screen is attributable to that and to nothing else.
//
// GEOMETRY IS FROZEN. `layer.spec.ts` measures this box: that it lands on the
// real floor when hosted, that it stops a bar's height short when it is not,
// and that its centre line stays collinear with the screen's while the screen
// flies. Width, height and the centre line are load-bearing; the palette is not
// and has been brought onto the site's.
//
// Narrower than the bar on purpose, so the bar is never fully hidden and the
// verdict stays a comparison rather than a memory of what used to be there.
function Sheet({ variant }: { variant: string }) {
  const { setOpenOn, copy } = useLayerCase();

  return (
    <div
      data-layer-sheet={variant}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[220px] w-[62%] flex-col items-center justify-end rounded-t-2xl bg-[var(--color-primary)] pb-6 shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.5)]"
    >
      {/*
        The registration line, and the whole pop test.
        The screen draws the same line at the same place. At rest the two
        segments are collinear. Hold a swipe-back halfway: if the sheet travels
        with its screen the line stays one line, and if the sheet is pinned to
        the viewport instead, it visibly breaks in two. Judging a 700ms slide by
        eye needs the gesture held, not replayed.
      */}
      <span
        data-layer-registration="sheet"
        className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white/70"
      />
      <button
        type="button"
        data-layer-close=""
        onClick={() => setOpenOn(null)}
        className="relative z-10 cursor-pointer rounded-full bg-white px-5 py-2 text-sm font-bold text-[var(--color-primary)]"
      >
        {copy.confirm}
      </button>
    </div>
  );
}

// Same element, two placements. `<Layer>` is the entire difference.
function LayerSheet({ step }: { step: "A" | "B" }) {
  const { openOn, hosted } = useLayerCase();

  if (openOn !== step) return null;

  return hosted ? (
    <Layer>
      <Sheet variant="hosted" />
    </Layer>
  ) : (
    <Sheet variant="inline" />
  );
}

export default LayerSheet;

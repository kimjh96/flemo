"use client";

import { Layer } from "@flemo/react";

import { useLayerCase } from "../../_providers/LayerCaseContext";

// The sheet a consumer writes: `position: fixed`, on the floor, with a
// z-index that beats the bar's. The SAME markup goes out both ways — the only
// difference between the two runs is whether <Layer> wraps it — so anything
// that differs on screen is attributable to that and to nothing else.
//
// Narrower than the bar on purpose, so the bar is never fully hidden and the
// verdict stays a comparison rather than a memory of what used to be there.
function Sheet() {
  const { hosted, setOpenOn } = useLayerCase();

  return (
    <div
      data-layer-sheet={hosted ? "hosted" : "inline"}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[220px] w-[62%] items-end justify-center bg-[#ff00c8]"
    >
      {/*
        The registration line, and the whole pop test.
        The screen draws the same white line at the same place. At rest the two
        segments are collinear. Hold a swipe-back at half way: if the sheet
        travels with its screen the line stays one line, and if the sheet is
        pinned to the viewport instead, it visibly breaks in two.
        Judging a 400ms slide by eye needs the gesture held, not replayed.
      */}
      <span
        data-layer-registration="sheet"
        className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white"
      />
      <button
        type="button"
        data-layer-close=""
        onClick={() => setOpenOn(null)}
        className="relative z-10 mb-6 bg-white px-5 py-2 text-sm font-bold text-black"
      >
        CLOSE
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
      <Sheet />
    </Layer>
  ) : (
    <Sheet />
  );
}

export default LayerSheet;

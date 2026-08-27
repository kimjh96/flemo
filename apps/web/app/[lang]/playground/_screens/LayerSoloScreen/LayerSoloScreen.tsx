"use client";

import { Layer, Screen, useNavigate } from "@flemo/react";

import LayerTabBar from "../../_components/LayerTabBar";
import { useLayerCase } from "../../_providers/LayerCaseContext";

// The SAME case without the nesting: one screen, its OWN shared bar, its own
// sheet, no nested Router anywhere.
//
// It exists because the symptom looks different here and the bug underneath is
// the same — which is easy to say and was worth measuring instead. A nested
// region is shorter than the viewport by its ancestor's bar, so a trapped
// sheet reads as a GEOMETRY gap and stops short of the floor. Here the screen
// IS the viewport, so a trapped sheet reaches the floor and reads as a
// STACKING loss instead: the bar comes over it. One root, two appearances.
function Sheet() {
  const { setOpenOn } = useLayerCase();

  return (
    <div
      data-layer-sheet="solo"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[220px] w-[62%] items-end justify-center bg-[#ff00c8]"
    >
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

function LayerSoloScreen() {
  const { push } = useNavigate({ router: "layer-shell" });
  const { openOn, setOpenOn, hosted, setHosted } = useLayerCase();
  const open = openOn === "SOLO";

  const sheet = hosted ? (
    <Layer>
      <Sheet />
    </Layer>
  ) : (
    <Sheet />
  );

  return (
    <Screen
      backgroundColor="#7a00ff"
      sharedBottomBar={<LayerTabBar />}
      sharedBottomBarId="layer-solo-chrome"
      systemNavigationBarHeight="0px"
      hideStatusBar
    >
      <div
        data-layer-solo=""
        className="relative flex h-full w-full flex-col items-center gap-10 pt-8"
        style={{ backgroundColor: "#7a00ff" }}
      >
        <div className="relative flex flex-wrap items-center justify-center gap-2 px-4">
          <button
            type="button"
            data-layer-open=""
            onClick={() => setOpenOn(open ? null : "SOLO")}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            {open ? "SHUT" : "OPEN"}
          </button>
          <button
            type="button"
            data-layer-toggle=""
            aria-pressed={hosted}
            onClick={() => setHosted(!hosted)}
            className="bg-black px-4 py-2 text-sm font-bold text-white"
          >
            {hosted ? "LAYER" : "INLINE"}
          </button>
          <button
            type="button"
            data-layer-region-push=""
            onClick={() => push("/playground/layer/away")}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            OUT
          </button>
        </div>
        <span className="relative text-[128px] leading-none font-black text-white">S</span>
      </div>

      {open ? sheet : null}
    </Screen>
  );
}

export default LayerSoloScreen;

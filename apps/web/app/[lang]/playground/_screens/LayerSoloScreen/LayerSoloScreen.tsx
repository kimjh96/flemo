"use client";

import { Layer, Screen, useNavigate } from "@flemo/react";

import LayerTabBar from "../../_components/LayerTabBar";
import { useLayerCase } from "../../_providers/LayerCaseContext";

const CONTROL =
  "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors";

// The SAME case without the nesting: one screen, its OWN shared bar, its own
// sheet, no nested Router anywhere.
//
// It exists because the symptom looks different here and the cause underneath
// is the same — which is easy to say and was worth measuring instead. A nested
// region is shorter than the viewport by its ancestor's bar, so a trapped sheet
// reads as a GEOMETRY gap and stops short of the floor. Here the screen IS the
// viewport, so a trapped sheet reaches the floor and reads as a STACKING loss
// instead: the bar comes over it. One cause, two appearances.
function Sheet() {
  const { setOpenOn, copy } = useLayerCase();

  return (
    <div
      data-layer-sheet="solo"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[220px] w-[62%] flex-col items-center justify-end rounded-t-2xl bg-[var(--color-primary)] pb-6 shadow-[0_-20px_50px_-20px_rgba(15,23,42,0.5)]"
    >
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

function LayerSoloScreen() {
  const { push } = useNavigate({ router: "layer-shell" });
  const { openOn, setOpenOn, hosted, setHosted, copy } = useLayerCase();
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
      backgroundColor="#3b1d5e"
      sharedBottomBar={<LayerTabBar />}
      sharedBottomBarId="layer-solo-chrome"
      systemNavigationBarHeight="0px"
      hideStatusBar
    >
      <div
        data-layer-solo=""
        className="relative flex h-full w-full flex-col items-center gap-8 pt-7"
        style={{ backgroundColor: "#3b1d5e" }}
      >
        <div className="relative flex flex-wrap items-center justify-center gap-1.5 px-4">
          <button
            type="button"
            data-layer-open=""
            onClick={() => setOpenOn(open ? null : "SOLO")}
            className={`${CONTROL} bg-white text-[#3b1d5e]`}
          >
            {open ? copy.shut : copy.open}
          </button>
          <button
            type="button"
            data-layer-toggle=""
            aria-pressed={hosted}
            onClick={() => setHosted(!hosted)}
            className={`${CONTROL} bg-black/35 text-white`}
          >
            {hosted ? copy.hosted : copy.inline}
          </button>
          <button
            type="button"
            data-layer-region-push=""
            onClick={() => push("/playground/layer/away")}
            className={`${CONTROL} bg-white/15 text-white`}
          >
            {copy.out}
          </button>
        </div>

        <span className="relative text-[15px] font-bold tracking-[0.2em] text-[#c9a6ff] uppercase">
          {copy.soloTitle}
        </span>
      </div>

      {open ? sheet : null}
    </Screen>
  );
}

export default LayerSoloScreen;

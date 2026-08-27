"use client";

import { Screen, useNavigate } from "@flemo/react";

import LayerSheet from "../../_components/LayerSheet";
import { useLayerCase } from "../../_providers/LayerCaseContext";

interface LayerStepScreenProps {
  /** A or B. Two screens, two colours, so a push is a thing you can see. */
  step: "A" | "B";
}

const SKIN = {
  A: { background: "#1338ff", label: "A" },
  B: { background: "#00b34a", label: "B" }
} as const;

// A screen inside the nested Router: the one that opens the sheet, and the one
// that has to cover a bar it does not own.
//
// Opaque and saturated on purpose. The previous fixture rendered the SAME
// component on both routes, so a push moved nothing anybody could name; here a
// blue screen leaving and a green one arriving is unmistakable at any speed.
function LayerStepScreen({ step }: LayerStepScreenProps) {
  const { push, pop } = useNavigate({ router: "layer-region" });
  const outer = useNavigate({ router: "layer-shell" });
  const { openOn, setOpenOn, hosted, setHosted } = useLayerCase();
  const open = openOn === step;
  const skin = SKIN[step];

  return (
    <Screen backgroundColor={skin.background} hideStatusBar systemNavigationBarHeight="0px">
      <div
        data-layer-step={step}
        // Controls at the TOP, letter in the middle, nothing at the bottom:
        // the sheet owns the floor, and a control under it is a control that
        // cannot be pressed once the case is set up. (That the sheet takes the
        // press at all is itself the host proving it does not swallow input.)
        className="relative flex h-full w-full flex-col items-center gap-10 pt-8"
        style={{ backgroundColor: skin.background }}
      >
        {/* The screen's half of the registration line. See LayerSheet. */}
        <span
          data-layer-registration="screen"
          className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white"
        />

        <div className="relative flex flex-wrap items-center justify-center gap-2 px-4">
          <button
            type="button"
            data-layer-open=""
            onClick={() => setOpenOn(open ? null : step)}
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
          {/* A push in the NESTED Router: stays under the bar the outer screen owns. */}
          <button
            type="button"
            data-layer-step-push=""
            onClick={() => push(step === "A" ? "/playground/layer/b" : "/playground/layer/a")}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            STEP
          </button>
          {/* A push in the OUTER Router: a whole new region over this one. */}
          <button
            type="button"
            data-layer-region-push=""
            onClick={() => outer.push("/playground/layer/away")}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            OUT
          </button>
          {/* The same case WITHOUT nesting, one push away. */}
          <button
            type="button"
            data-layer-solo-push=""
            onClick={() => outer.push("/playground/layer/solo")}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            SOLO
          </button>
          <button
            type="button"
            data-layer-pop=""
            onClick={() => pop()}
            className="bg-white px-4 py-2 text-sm font-bold text-black"
          >
            BACK
          </button>
        </div>

        <span className="relative text-[128px] leading-none font-black text-white">
          {skin.label}
        </span>
      </div>

      <LayerSheet step={step} />
    </Screen>
  );
}

export default LayerStepScreen;

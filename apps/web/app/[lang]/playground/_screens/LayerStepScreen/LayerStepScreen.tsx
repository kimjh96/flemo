"use client";

import { Screen, useNavigate } from "@flemo/react";

import LayerSheet from "../../_components/LayerSheet";
import { useLayerCase } from "../../_providers/LayerCaseContext";

interface LayerStepScreenProps {
  /** A or B. Two sections, two surfaces, so a push is a thing you can see. */
  step: "A" | "B";
}

const SKIN = {
  A: { background: "#1d2a5e", accent: "#8fa6ff" },
  B: { background: "#0f4b45", accent: "#71d8c6" }
} as const;

const CONTROL =
  "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors";

// A screen inside the nested Router: the one that opens the sheet, and the one
// that has to cover a bar it does not own.
//
// The two sections stay strongly and differently coloured. That is not
// decoration left over from the old fixture — a push has to be unmistakable at
// any speed for the swipe-hold test to mean anything, and two screens that look
// alike make "did it travel with its screen" unanswerable by eye. What changed
// is the palette: deep, saturated app surfaces instead of primary blue and
// green.
//
// Controls at the TOP, nothing at the bottom: the sheet owns the floor, and a
// control under it is a control that cannot be pressed once the case is set up.
// (That the sheet takes the press at all is itself the host proving it does not
// swallow input.)
function LayerStepScreen({ step }: LayerStepScreenProps) {
  const { push, pop } = useNavigate({ router: "layer-region" });
  const outer = useNavigate({ router: "layer-shell" });
  const { openOn, setOpenOn, hosted, setHosted, copy } = useLayerCase();
  const open = openOn === step;
  const skin = SKIN[step];

  return (
    <Screen backgroundColor={skin.background} hideStatusBar systemNavigationBarHeight="0px">
      <div
        data-layer-step={step}
        className="relative flex h-full w-full flex-col items-center gap-8 pt-7"
        style={{ backgroundColor: skin.background }}
      >
        {/* The screen's half of the registration line. See LayerSheet. */}
        <span
          data-layer-registration="screen"
          className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-white/70"
        />

        <div className="relative flex flex-wrap items-center justify-center gap-1.5 px-4">
          <button
            type="button"
            data-layer-open=""
            onClick={() => setOpenOn(open ? null : step)}
            className={`${CONTROL} bg-white text-[#1d2a5e]`}
          >
            {open ? copy.shut : copy.open}
          </button>
          {/* THE SINGLE VARIABLE. `aria-pressed` is what the suite reads to set
              the case up, so it stays whatever the labels become. */}
          <button
            type="button"
            data-layer-toggle=""
            aria-pressed={hosted}
            onClick={() => setHosted(!hosted)}
            className={`${CONTROL} bg-black/35 text-white`}
          >
            {hosted ? copy.hosted : copy.inline}
          </button>
          {/* A push in the NESTED Router: stays under the bar the outer screen
              owns. */}
          <button
            type="button"
            data-layer-step-push=""
            onClick={() => push(step === "A" ? "/playground/layer/b" : "/playground/layer/a")}
            className={`${CONTROL} bg-white/15 text-white`}
          >
            {copy.step}
          </button>
          {/* A push in the OUTER Router: a whole new region over this one. */}
          <button
            type="button"
            data-layer-region-push=""
            onClick={() => outer.push("/playground/layer/away")}
            className={`${CONTROL} bg-white/15 text-white`}
          >
            {copy.out}
          </button>
          {/* The same case WITHOUT nesting, one push away. */}
          <button
            type="button"
            data-layer-solo-push=""
            onClick={() => outer.push("/playground/layer/solo")}
            className={`${CONTROL} bg-white/15 text-white`}
          >
            {copy.solo}
          </button>
          <button
            type="button"
            data-layer-pop=""
            onClick={() => pop()}
            className={`${CONTROL} bg-white/15 text-white`}
          >
            {copy.back}
          </button>
        </div>

        <span
          className="relative text-[15px] font-bold tracking-[0.2em] uppercase"
          style={{ color: skin.accent }}
        >
          {step === "A" ? copy.sectionA : copy.sectionB}
        </span>
      </div>

      <LayerSheet step={step} />
    </Screen>
  );
}

export default LayerStepScreen;

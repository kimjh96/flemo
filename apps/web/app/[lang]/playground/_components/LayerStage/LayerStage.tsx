"use client";

import LayerRouter from "../../_router/LayerRouter";

// THE LAYERING CASE. Every other stage here asks whether a transition looks
// right; this one asks where a consumer's overlay ends up while one runs.
//
// A screen that moves carries a transform, so it is a containing block and a
// stacking context for everything inside it, while the shared bars sit outside.
// A sheet written in the screen is therefore one atom with the screen's content
// as far as the bar is concerned — it cannot be interleaved with it — and
// <Layer> is what moves it beside the screen instead. The toggle renders the
// same sheet both ways so the difference is a thing to look at rather than a
// paragraph to believe.
function LayerStage() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 pb-20">
      <header>
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-[var(--color-text-primary)]">
          Overlay layering
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          A nested Router under a shared tab bar, and a bottom sheet that has to cover it. Toggle
          &lt;Layer&gt;, then push and swipe back with the sheet open.
        </p>
      </header>

      <div className="flex justify-center">
        {/*
          The frame stands in for the viewport. `translateZ(0)` is what makes it
          one: a consumer sheet is `position: fixed`, and on a phone that means
          the screen edge, so inside a 380x720 stage on a scrolling page it has
          to mean the stage edge instead. A transform is the containing block
          that says so. Fixture-only — a real app's root Router is already
          fixed to the viewport and needs none of this.
        */}
        <div
          className="relative h-[720px] w-[380px] overflow-hidden rounded-[34px] border border-[var(--color-border-light)] shadow-[0_34px_80px_-26px_rgba(15,23,42,0.35)] [transform:translateZ(0)]"
          data-layer-stage=""
        >
          <LayerRouter />
        </div>
      </div>
    </div>
  );
}

export default LayerStage;

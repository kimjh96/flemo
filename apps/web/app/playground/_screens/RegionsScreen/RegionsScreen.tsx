"use client";

import { Route, Router, Screen, useNavigate } from "@flemo/react";

import { gradientFor } from "@/app/playground/_data/gradient";

// A partial-area demo: the outer Screen's header and footer stay put while only
// the bordered card region in the middle transitions. That region is a NESTED
// <Router> — it runs its own local history (no URL change, no browser back), so
// the Next / Back buttons slide its cards within the box, leaving everything
// around it untouched.

interface RegionStepProps {
  step: number;
  hue: number;
  onNext?: () => void;
  onBack?: () => void;
}

// A single card inside the region. It's a contained <Screen>, so flemo anchors
// it to the region box (position: absolute) and slides it within those bounds.
function RegionStep({ step, hue, onNext, onBack }: RegionStepProps) {
  return (
    <Screen hideStatusBar hideSystemNavigationBar backgroundColor="transparent">
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: gradientFor(hue) }}
      >
        <div className="text-xs font-semibold uppercase tracking-widest text-white/70">
          Region card
        </div>
        <div className="text-4xl font-bold text-white">Step {step}</div>
        <div className="flex gap-2">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="cursor-pointer rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
            >
              Back
            </button>
          )}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="cursor-pointer rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </Screen>
  );
}

function RegionStepOne() {
  const navigate = useNavigate();
  return <RegionStep step={1} hue={210} onNext={() => navigate.push("/region/step-2")} />;
}

function RegionStepTwo() {
  const navigate = useNavigate();
  return (
    <RegionStep
      step={2}
      hue={150}
      onBack={() => navigate.pop()}
      onNext={() => navigate.push("/region/step-3")}
    />
  );
}

function RegionStepThree() {
  const navigate = useNavigate();
  return <RegionStep step={3} hue={330} onBack={() => navigate.pop()} />;
}

function RegionsScreen() {
  return (
    <Screen backgroundColor="var(--color-surface)">
      <div className="flex h-full w-full flex-col px-5 py-6">
        <header className="shrink-0">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            Partial-area regions
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            Only the card below transitions. This header stays put.
          </p>
        </header>

        {/* The region: a nested <Router>. Sized here; its screens are contained
            to this box and slide within it. */}
        <Router
          initPath="/region/step-1"
          className="my-5 grow overflow-hidden rounded-2xl border border-[var(--color-line)]"
        >
          <Route path="/region/step-1" element={<RegionStepOne />} />
          <Route path="/region/step-2" element={<RegionStepTwo />} />
          <Route path="/region/step-3" element={<RegionStepThree />} />
        </Router>

        <footer className="shrink-0 text-center text-xs text-[var(--color-ink-mute)]">
          ↑ nested &lt;Router&gt; · local history · no URL change · footer stays too
        </footer>
      </div>
    </Screen>
  );
}

export default RegionsScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/regions": undefined;
    "/region/step-1": undefined;
    "/region/step-2": undefined;
    "/region/step-3": undefined;
  }
}

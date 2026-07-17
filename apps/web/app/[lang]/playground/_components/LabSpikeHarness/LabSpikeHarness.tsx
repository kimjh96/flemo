"use client";

import { useEffect, useRef, useState } from "react";

import { useNavigate, type TransitionName } from "@flemo/react";

// Perception measurement harness UI (playground-only, never shipped to npm).
// Renders the trigger buttons the Playwright motion-energy script clicks (see
// apps/web/e2e/perception), plus a fixed corner "tap marker" that flashes on
// trigger. The marker gives the video a
// deterministic, spatially-isolated blip at the exact click tick (it sits
// OUTSIDE the transitioning <Slot>, so the transition's own motion never
// overlaps it), which the analyzer uses as the freeze-gap anchor: freeze =
// (first big-motion frame of the transition) − (marker blip frame).
//
// Each button enters the heavy fixture screen with a chosen transition and a
// chosen synchronous block size, so the script can sweep transition × blockMs.

const MARKER_ID = "__spikeTapMarker";

// The harness only renders when opted in: the measurement script sets this key
// via addInitScript before navigation, OR a maintainer appends `?spike=1` to the
// URL to eyeball the behavior on a device where DevTools (and thus localStorage
// editing) is unavailable. A fixed overlay of trigger buttons must never sit
// over the real playground UI for users or the regular e2e suite — on the mobile
// viewport it covers the panel's own buttons — so the default (no key, no query)
// stays fully hidden.
const ENABLE_KEY = "flemo:spike-harness";

// URL opt-in: `?spike=1` also enables the harness, and is persisted to the
// localStorage key so later in-app client navigations (which drop the query
// string) keep it visible.
const ENABLE_QUERY_PARAM = "spike";

const BLOCKS = [0, 200, 400, 800] as const;
const TRANSITIONS: { name: TransitionName; key: string }[] = [
  { name: "tab-forward", key: "fade" },
  { name: "cupertino", key: "cupertino" }
];

function LabSpikeHarness() {
  const navigate = useNavigate();
  const markerRef = useRef<HTMLDivElement>(null);
  // Post-mount read keeps SSR markup and the first client render identical
  // (the harness is measurement-only UI; appearing a frame late is free).
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Enabled by the measurement script's persisted flag OR a `?spike=1` query
    // parameter. When the query enables it, persist the flag so subsequent
    // client navigations keep the harness up without the query string. The
    // addInitScript path is untouched: it writes the same localStorage key.
    const storedEnabled = localStorage.getItem(ENABLE_KEY) === "1";
    const queryEnabled =
      new URLSearchParams(window.location.search).get(ENABLE_QUERY_PARAM) === "1";
    if (queryEnabled && !storedEnabled) {
      localStorage.setItem(ENABLE_KEY, "1");
    }
    setEnabled(storedEnabled || queryEnabled);
  }, []);

  const handleTrigger = (transition: TransitionName, block: number) => {
    // Flash the marker white in the SAME synchronous tick as the navigation, so
    // the video's tap anchor and the transition's start share one clock. The
    // marker stays white (a single on-blip, no off-blip to confuse clustering).
    if (markerRef.current) markerRef.current.style.background = "#ffffff";
    navigate.push("/playground/heavy", { block: String(block) }, { transitionName: transition });
  };

  if (!enabled) return null;

  return (
    <>
      <div
        ref={markerRef}
        id={MARKER_ID}
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 size-16 bg-transparent"
      />
      <div className="pointer-events-auto fixed top-[calc(env(safe-area-inset-top)+16px)] left-1/2 z-40 flex -translate-x-1/2 flex-col gap-1 rounded-2xl border border-white/15 bg-black/70 p-2 backdrop-blur-md">
        {TRANSITIONS.map(({ name, key }) => (
          <div key={key} className="flex gap-1">
            {BLOCKS.map((block) => (
              <button
                key={block}
                type="button"
                data-testid={`spike-${key}-${block}`}
                onClick={() => handleTrigger(name, block)}
                className="cursor-pointer rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
              >
                {key} {block}
              </button>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export default LabSpikeHarness;

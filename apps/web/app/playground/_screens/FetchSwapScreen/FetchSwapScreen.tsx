"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useNavigate, useParams } from "@flemo/react";

import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";

import FetchSwapAppBar from "./FetchSwapAppBar";

// Counter + swap timestamp exposed on `window` so the e2e can correlate the
// content swap against the push animation window without test-only globals
// leaking into the app's own screens.
declare global {
  interface Window {
    __flemoFetchSwapCount?: number;
  }
}

// Repro for the WebKit "abbreviated transition" report. Models the real-app
// scenario (shiflo / plen): a screen is pushed showing a light skeleton, then
// an async fetch resolves MID-ANIMATION and swaps in heavy content. The swapped
// subtree repaints inside the still-sliding `data-flemo-screen` scope, which is
// the very layer the `transform` keyframe animates. On WebKit that layer's
// backing-store re-raster stalls presentation, so the slide appears to skip
// ahead and finish late. With a warm cache the content is present at mount and
// nothing repaints mid-animation, so the slide stays smooth (matches the report).
//
//   delayMs: when the simulated fetch resolves after mount. Tuned to land
//            inside the cupertino push window (~700ms) so the swap overlaps the
//            in-flight animation.
//   nodes:   weight of the resolved content. Drives the layout/paint/raster
//            cost of the mid-animation swap.
//
// The fetch is a `setTimeout`, NOT a busy-wait: the only main-thread work is
// React committing the swapped subtree and the browser laying it out and
// rasterizing it. That keeps the signal about the browser's layer handling,
// not synthetic CPU we injected ourselves.
function FetchSwapScreen() {
  const params = useParams<"/fetch-swap/:delayMs/:nodes">();
  const navigate = useNavigate();
  const delayMs = params ? Number(params.delayMs) : 150;
  const nodeCount = params ? Number(params.nodes) : 1500;

  const [resolved, setResolved] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setResolved(true), delayMs);
    return () => window.clearTimeout(id);
  }, [delayMs]);

  // After the swap commits, stamp the page clock and force one layout flush so
  // the new subtree's layout/paint lands within this frame (the worst case for
  // the in-flight compositor animation, and the one users actually hit).
  useLayoutEffect(() => {
    if (!resolved) return;
    window.__flemoFetchSwapCount = (window.__flemoFetchSwapCount ?? 0) + 1;
    performance.mark("flemo-fetch-swap");
    const root = rootRef.current;
    if (root) void root.getBoundingClientRect().height;
  }, [resolved]);

  const items = resolved ? Array.from({ length: nodeCount }, (_, i) => i) : [];

  const handlePushAnother = () =>
    navigate.push(
      "/fetch-swap/:delayMs/:nodes",
      { delayMs: String(delayMs), nodes: String(nodeCount) },
      { transitionName: "cupertino" }
    );

  return (
    <PlayerScreen appBar={<FetchSwapAppBar />}>
      {/* Left-edge tracking stripe: a unique solid color pinned to the scope's
          left edge. The scope slides in `translateX` during the push, and the
          `transform` makes it the containing block for this absolutely
          positioned child, so the stripe's on-screen X is a direct readout of
          the slide. The e2e samples its pixel position frame-by-frame to detect
          a presentation jump that JS timeline values (getComputedStyle) can't
          see. */}
      <div
        data-fetch-swap-marker
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 6,
          height: "100%",
          background: "#ff00aa",
          zIndex: 2
        }}
      />
      <div
        ref={rootRef}
        data-fetch-swap
        data-fetch-swap-resolved={resolved ? "true" : "false"}
        className="flex min-h-full w-full flex-col bg-[var(--color-surface)]"
      >
        <div className="flex flex-col gap-2 border-b border-[var(--color-line)] px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-soft)]">
              Fetch-swap repro
            </span>
            <span className="text-[11px] tabular-nums text-[var(--color-ink-mute)]">
              {delayMs}ms · {nodeCount} nodes
            </span>
          </div>
          <p className="text-[12px] leading-snug text-[var(--color-ink-soft)]">
            Pushes with a skeleton, then swaps in heavy content {delayMs}ms later, mid-animation.
            Watch the slide on WebKit: it skips ahead and lands late.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="fetch-swap-push-next"
              onClick={handlePushAnother}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
            >
              Push another
            </button>
          </div>
        </div>

        {!resolved ? (
          // Skeleton shown while the simulated fetch is in flight.
          <div data-fetch-swap-skeleton className="flex flex-1 flex-col gap-3 px-5 py-4">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-4 w-1/2 rounded-full bg-[var(--color-layer)]" />
            ))}
          </div>
        ) : (
          // Resolved heavy content: `nodes` rows, each a small card with text so
          // the swap carries real layout + raster cost, not just empty boxes.
          <div data-fetch-swap-content className="flex flex-1 flex-col gap-2 px-5 py-4">
            {items.map((i) => (
              <div
                key={i}
                data-fetch-node
                className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-2"
              >
                <div className="h-8 w-8 shrink-0 rounded-full bg-[var(--color-surface)]" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="truncate text-[12px] font-medium text-[var(--color-text-primary)]">
                    Result row {i}
                  </div>
                  <div className="truncate text-[11px] text-[var(--color-ink-soft)]">
                    Loaded after the transition started
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PlayerScreen>
  );
}

export default FetchSwapScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/fetch-swap/:delayMs/:nodes": { delayMs: string; nodes: string };
  }
}

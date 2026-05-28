"use client";

import { useLayoutEffect, useRef } from "react";

import { useNavigate, useParams } from "@flemo/react";

import { PlayerScreen } from "@/app/playground/_screens/PlayerScreen";

import HeavyArrivalAppBar from "./HeavyArrivalAppBar";

// Render counter exposed on `window.__flemoHeavyRenderCount` so the e2e
// can observe whether React actually re-renders this component after the
// initial mount (e.g., status flip triggering a parent re-render).
declare global {
  interface Window {
    __flemoHeavyRenderCount?: number;
  }
}

// Synthetic destination screen for the rAF / long-frame benchmarking spec.
// Two knobs, both read from path params so the e2e can craft scenarios
// without test-only globals leaking into the app:
//
//   cpuMs — busy-wait inside the render body. Models a synchronous JSX
//           render that a consumer might write (heavy `.map`s, expensive
//           computed children). Lands on the React commit thread, so it's
//           the kind of work `startTransition` is designed to defer.
//
//   nodes — tree size. Drives the layout/paint cost of the initial mount.
//           Combined with a `useLayoutEffect` that touches every node's
//           `offsetWidth`, this forces a synchronous reflow whose scope is
//           the variable under test for `contain: layout paint`.
function HeavyArrivalScreen() {
  const params = useParams<"/heavy/:cpuMs/:nodes">();
  const navigate = useNavigate();
  const cpuMs = params ? Number(params.cpuMs) : 0;
  const nodeCount = params ? Number(params.nodes) : 0;

  if (typeof window !== "undefined") {
    window.__flemoHeavyRenderCount = (window.__flemoHeavyRenderCount ?? 0) + 1;
  }

  // Busy-wait. Yields the same hot-loop block as a real expensive render —
  // the React reconciler is on the main thread while this is running.
  if (cpuMs > 0) {
    const until = performance.now() + cpuMs;
    while (performance.now() < until) {
      // intentionally empty — hot loop
    }
  }

  const items = Array.from({ length: nodeCount }, (_, i) => i);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Force one synchronous reflow on mount. All width writes go first
  // (single style mutation batch), then a single `getBoundingClientRect`
  // forces the browser to flush layout across every child in one pass.
  // Without `contain` this reflow propagates up through ancestors; with
  // `contain` it stays scoped.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const children = root.querySelectorAll<HTMLDivElement>("[data-heavy-node]");
    children.forEach((el, i) => {
      el.style.width = `${50 + (i % 20)}%`;
    });
    // Single layout flush.
    void root.getBoundingClientRect().width;
  }, [nodeCount]);

  return (
    <PlayerScreen appBar={<HeavyArrivalAppBar />}>
      <div
        ref={rootRef}
        data-heavy-arrival
        data-heavy-cpu-ms={cpuMs}
        data-heavy-node-count={nodeCount}
        className="flex min-h-full w-full flex-col gap-1 bg-[var(--color-surface)] px-5 pb-8 pt-3"
      >
        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--color-ink-soft)]">
            cpuMs={cpuMs} · nodes={nodeCount}
          </div>
          <button
            type="button"
            data-testid="perf-push-next"
            onClick={() =>
              navigate.push(
                "/heavy/:cpuMs/:nodes",
                { cpuMs: String(cpuMs), nodes: String(nodeCount) },
                { transitionName: "cupertino" }
              )
            }
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            Push another
          </button>
        </div>
        {items.map((i) => (
          <div
            key={i}
            data-heavy-node
            className="h-4 rounded bg-[var(--color-layer)] text-[10px] text-[var(--color-ink-soft)]"
          >
            {i}
          </div>
        ))}
      </div>
    </PlayerScreen>
  );
}

export default HeavyArrivalScreen;

declare module "@flemo/react" {
  interface RegisterRoute {
    "/heavy/:cpuMs/:nodes": { cpuMs: string; nodes: string };
  }
}

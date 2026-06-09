"use client";

import { useLayoutEffect, useRef } from "react";

import { useNavigate, useParams, useScreen } from "@flemo/react";

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
//   cpuMs: busy-wait inside the render body. Models a synchronous JSX
//           render that a consumer might write (heavy `.map`s, expensive
//           computed children). Lands on the React commit thread, so it's
//           the kind of work `startTransition` is designed to defer.
//
//   nodes: tree size. Drives the layout/paint cost of the initial mount.
//           Combined with a `useLayoutEffect` that touches every node's
//           `offsetWidth`, this forces a synchronous reflow whose scope is
//           the variable under test for `contain: layout paint`.
function HeavyArrivalScreen() {
  const params = useParams<"/heavy/:cpuMs/:nodes">();
  const navigate = useNavigate();
  // `zIndex` is this screen's depth in the stack (Library is 0). The skip /
  // collapse controls only make sense once there's something below to skip.
  const { zIndex } = useScreen();
  const cpuMs = params ? Number(params.cpuMs) : 0;
  const nodeCount = params ? Number(params.nodes) : 0;

  if (typeof window !== "undefined") {
    window.__flemoHeavyRenderCount = (window.__flemoHeavyRenderCount ?? 0) + 1;
  }

  // Busy-wait. Yields the same hot-loop block as a real expensive render.
  // The React reconciler is on the main thread while this is running.
  if (cpuMs > 0) {
    const until = performance.now() + cpuMs;
    while (performance.now() < until) {
      // intentionally empty (hot loop)
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

  const handlePushAnother = () =>
    navigate.push(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodeCount) },
      { transitionName: "cupertino" }
    );
  const handlePopTwo = () => navigate.pop({ skip: 2 });
  const handlePopThree = () => navigate.pop({ skip: 3 });
  const handlePopToLibrary = () => navigate.pop({ until: "/" });
  const handleReplaceCollapse = () =>
    navigate.replace(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodeCount) },
      { skip: 2, transitionName: "cupertino" }
    );
  const handlePushCollapse = () =>
    navigate.push(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodeCount) },
      { skip: 2, transitionName: "cupertino" }
    );

  // Each control skips/collapses screens in one transition; with a heavy tree
  // behind every push, this is the clearest place to confirm the skipped
  // screens never paint and back/forward stay correct. The multi-screen
  // controls only appear once the stack is deep enough for them to do anything
  // (e.g. "Pop 3 screens" needs three screens below the top).
  const controls = [
    {
      testid: "perf-push-next",
      label: "Push another",
      onClick: handlePushAnother,
      show: true
    },
    {
      testid: "perf-pop-2",
      label: "Pop 2 screens",
      onClick: handlePopTwo,
      show: zIndex >= 2
    },
    {
      testid: "perf-pop-3",
      label: "Pop 3 screens",
      onClick: handlePopThree,
      show: zIndex >= 3
    },
    {
      testid: "perf-popto-root",
      label: "Pop to Library",
      onClick: handlePopToLibrary,
      show: zIndex >= 2
    },
    {
      testid: "perf-replace-collapse",
      label: "Replace · skip 2",
      onClick: handleReplaceCollapse,
      // replace REPLACES the reached screen, so skip 2 needs a screen two below
      // the top that isn't the Library root, i.e. depth ≥ 3. (pop/push keep
      // the reached screen, so they're fine landing on the root at depth 2.)
      show: zIndex >= 3
    },
    {
      testid: "perf-push-skip",
      label: "Push · skip 2",
      onClick: handlePushCollapse,
      show: zIndex >= 2
    }
  ].filter((control) => control.show);

  return (
    <PlayerScreen appBar={<HeavyArrivalAppBar />}>
      <div
        ref={rootRef}
        data-heavy-arrival
        data-heavy-cpu-ms={cpuMs}
        data-heavy-node-count={nodeCount}
        className="flex min-h-full w-full flex-col bg-[var(--color-surface)]"
      >
        <div className="flex flex-col gap-2 border-b border-[var(--color-line)] px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-ink-soft)]">
              Navigation demo
            </span>
            <span className="text-[11px] tabular-nums text-[var(--color-ink-mute)]">
              cpuMs {cpuMs} · {nodeCount} nodes
            </span>
          </div>
          <p className="text-[12px] leading-snug text-[var(--color-ink-soft)]">
            Push to stack heavy screens, then jump several back (or replace them) in one transition.
            The skipped screens never paint.
          </p>
          {/* Wrap so the buttons never clip the phone frame. */}
          <div className="flex flex-wrap gap-1.5">
            {controls.map(({ testid, label, onClick }) => (
              <button
                key={testid}
                type="button"
                data-testid={testid}
                onClick={onClick}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* The heavy tree: `nodes` skeleton rows. Their widths are set by the
            reflow effect above and read as content-line placeholders. */}
        <div className="flex flex-1 flex-col gap-2 px-5 py-4">
          {items.map((i) => (
            <div key={i} data-heavy-node className="h-3 rounded-full bg-[var(--color-layer)]" />
          ))}
        </div>
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

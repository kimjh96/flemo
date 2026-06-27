"use client";

import { useNavigate } from "@flemo/react";

import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";

// Entry points for `apps/web/e2e/fetch-swap.spec.ts`. They push
// `/fetch-swap/:delayMs/:nodes`, which renders a skeleton and then swaps in
// heavy content `delayMs` after mount, mid-push-animation. The spec uses these
// to reproduce and measure the WebKit "abbreviated transition" report (the
// content swap repaints inside the sliding scope layer and stalls its
// presentation on WebKit). Same dev-panel rationale as the benchmark card:
// developer controls, kept out of the in-app screens and the embedded hero.
interface Scenario {
  label: string;
  // The transition to push with. Spans the two compositability classes:
  //   cupertino (translate), zoom (scale + opacity) → compositor-accelerated,
  //     fully covered by the content-layer fix.
  //   blur (filter), reveal (clip-path) → animate non-compositable properties
  //     on the screen scope, so that part runs on the main thread and the fix
  //     can't decouple it. Kept here to document the boundary.
  transition: "cupertino" | "zoom" | "blur" | "reveal";
  mode: "now" | "deferred";
  delayMs: number;
  nodes: number;
}

const scenarios: Scenario[] = [
  { label: "cupertino · now", transition: "cupertino", mode: "now", delayMs: 150, nodes: 1500 },
  {
    label: "cupertino · deferred",
    transition: "cupertino",
    mode: "deferred",
    delayMs: 150,
    nodes: 1500
  },
  { label: "zoom · now", transition: "zoom", mode: "now", delayMs: 150, nodes: 1500 },
  { label: "zoom · deferred", transition: "zoom", mode: "deferred", delayMs: 150, nodes: 1500 },
  { label: "blur · now", transition: "blur", mode: "now", delayMs: 150, nodes: 1500 },
  { label: "blur · deferred", transition: "blur", mode: "deferred", delayMs: 150, nodes: 1500 },
  { label: "reveal · now", transition: "reveal", mode: "now", delayMs: 150, nodes: 1500 },
  { label: "reveal · deferred", transition: "reveal", mode: "deferred", delayMs: 150, nodes: 1500 }
];

const buttonClassName =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]";

function PlaygroundFetchSwapCard() {
  const navigate = useNavigate();

  const handlePush = (scenario: Scenario) =>
    navigate.push(
      "/fetch-swap/:mode/:delayMs/:nodes",
      { mode: scenario.mode, delayMs: String(scenario.delayMs), nodes: String(scenario.nodes) },
      { transitionName: scenario.transition }
    );

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="WebKit repro"
        title="Fetch-swap transition"
        description="Push with a skeleton, then swap in heavy content mid-animation. Reproduces the WebKit abbreviated-slide report."
      />
      <div data-testid="fetch-swap-scenarios" className="flex flex-wrap gap-2">
        {scenarios.map((scenario) => (
          <button
            key={`fetch-swap-${scenario.label}`}
            type="button"
            data-testid={`fetch-swap-push-${scenario.transition}-${scenario.mode}-${scenario.delayMs}-${scenario.nodes}`}
            onClick={() => handlePush(scenario)}
            className={buttonClassName}
          >
            {scenario.label}
          </button>
        ))}
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundFetchSwapCard;

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
  mode: "now" | "deferred";
  delayMs: number;
  nodes: number;
}

const scenarios: Scenario[] = [
  { label: "Now · heavy", mode: "now", delayMs: 150, nodes: 1500 },
  { label: "Now · late", mode: "now", delayMs: 300, nodes: 1500 },
  { label: "Deferred · heavy", mode: "deferred", delayMs: 150, nodes: 1500 },
  { label: "Deferred · late", mode: "deferred", delayMs: 300, nodes: 1500 }
];

const buttonClassName =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]";

function PlaygroundFetchSwapCard() {
  const navigate = useNavigate();

  const handlePush = (mode: "now" | "deferred", delayMs: number, nodes: number) =>
    navigate.push(
      "/fetch-swap/:mode/:delayMs/:nodes",
      { mode, delayMs: String(delayMs), nodes: String(nodes) },
      { transitionName: "cupertino" }
    );

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="WebKit repro"
        title="Fetch-swap transition"
        description="Push with a skeleton, then swap in heavy content mid-animation. Reproduces the WebKit abbreviated-slide report."
      />
      <div data-testid="fetch-swap-scenarios" className="flex flex-wrap gap-2">
        {scenarios.map(({ label, mode, delayMs, nodes }) => (
          <button
            key={`fetch-swap-${label}`}
            type="button"
            data-testid={`fetch-swap-push-${mode}-${delayMs}-${nodes}`}
            onClick={() => handlePush(mode, delayMs, nodes)}
            className={buttonClassName}
          >
            {label}
          </button>
        ))}
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundFetchSwapCard;

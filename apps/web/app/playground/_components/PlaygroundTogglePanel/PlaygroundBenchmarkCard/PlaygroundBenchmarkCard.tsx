"use client";

import { useNavigate } from "@flemo/react";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";

// Benchmark entry points for `apps/web/e2e/heavy-screen.spec.ts` and
// `deep-stack.spec.ts`. They push `/heavy/:cpuMs/:nodes` so the specs can
// measure rAF cadence, long-animation-frame events, and click→COMPLETED
// latency for arrival screens of varying weight, clicked by `data-testid`.
//
// Lives in the dev panel (outside the phone frame) on purpose: these are
// developer/benchmark controls, not part of the music app, so they stay out
// of the in-app screens (and out of the embedded hero, which renders only the
// bare Router). `useNavigate` reads flemo's global stores, so a push from here
// drives the Router mounted inside the frame just the same.
interface Scenario {
  label: string;
  cpuMs: number;
  nodes: number;
}

const scenarios: Scenario[] = [
  { label: "Light", cpuMs: 0, nodes: 50 },
  { label: "CPU 120ms", cpuMs: 120, nodes: 50 },
  { label: "Big tree (2k)", cpuMs: 0, nodes: 2000 },
  { label: "Both", cpuMs: 120, nodes: 2000 }
];

const buttonClassName =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]";

function PlaygroundBenchmarkCard() {
  const navigate = useNavigate();
  const t = usePlaygroundDict().devPanel.performance;

  const handlePush = (cpuMs: number, nodes: number) =>
    navigate.push(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodes) },
      { transitionName: "cupertino" }
    );

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="Performance"
        title={t.title}
        description={t.description}
      />
      <div data-testid="perf-scenarios" className="flex flex-wrap gap-2">
        {scenarios.map(({ label, cpuMs, nodes }) => (
          <button
            key={`push-${label}`}
            type="button"
            data-testid={`perf-push-${cpuMs}-${nodes}`}
            onClick={() => handlePush(cpuMs, nodes)}
            className={buttonClassName}
          >
            {label}
          </button>
        ))}
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundBenchmarkCard;

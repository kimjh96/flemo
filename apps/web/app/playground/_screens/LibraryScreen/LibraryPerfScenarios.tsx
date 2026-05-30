"use client";

import { useNavigate } from "@flemo/react";

// Benchmark entry points for `apps/web/e2e/heavy-screen.spec.ts`. Each
// button pushes `/heavy/:cpuMs/:nodes` so the spec can measure rAF cadence,
// long-animation-frame events, and click→COMPLETED latency for arrival
// screens of varying weight. Visible in the playground intentionally — the
// performance story is part of what the playground demonstrates, and the
// e2e clicks these by `data-testid`.
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

function LibraryPerfScenarios() {
  const navigate = useNavigate();

  const handlePush = (cpuMs: number, nodes: number) =>
    navigate.push(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodes) },
      { transitionName: "cupertino" }
    );

  const handleReplace = (cpuMs: number, nodes: number) =>
    navigate.replace(
      "/heavy/:cpuMs/:nodes",
      { cpuMs: String(cpuMs), nodes: String(nodes) },
      { transitionName: "cupertino" }
    );

  return (
    <section
      data-testid="perf-scenarios"
      className="mt-8 flex flex-col gap-3 border-t border-[var(--color-line)] pt-4"
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
        Perf scenarios — push
      </div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map(({ label, cpuMs, nodes }) => (
          <button
            key={`push-${label}`}
            type="button"
            data-testid={`perf-push-${cpuMs}-${nodes}`}
            onClick={() => handlePush(cpuMs, nodes)}
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-soft)]">
        Perf scenarios — replace
      </div>
      <div className="flex flex-wrap gap-2">
        {scenarios.map(({ label, cpuMs, nodes }) => (
          <button
            key={`replace-${label}`}
            type="button"
            data-testid={`perf-replace-${cpuMs}-${nodes}`}
            onClick={() => handleReplace(cpuMs, nodes)}
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface)]"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

export default LibraryPerfScenarios;

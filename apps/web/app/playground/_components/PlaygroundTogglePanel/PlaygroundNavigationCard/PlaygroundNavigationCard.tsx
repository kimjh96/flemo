"use client";

import { useHistoryStore } from "@flemo/core";
import { useNavigate } from "@flemo/react";

import { usePlaygroundDict } from "@/app/playground/_providers/PlaygroundIntlProvider";

import PlaygroundToggleCard from "../PlaygroundToggleCard";
import PlaygroundToggleCardHeader from "../PlaygroundToggleCardHeader";

// The demo stacks the synthetic heavy screen (light config) so each push is a
// visibly distinct arrival, then reaches past the top with {skip}/{until} in a
// single transition. The skipped screens never paint. Seed to this depth so
// the multi-screen ops have something to collapse.
const SEED_DEPTH = 4;
const heavyParams = { cpuMs: "0", nodes: "50" } as const;

const buttonClassName =
  "rounded-md border border-[var(--color-line)] bg-[var(--color-layer)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40";

function PlaygroundNavigationCard() {
  const navigate = useNavigate();
  const depth = useHistoryStore((state) => state.histories.length);
  const t = usePlaygroundDict().devPanel.navigation;

  const canPopOne = depth >= 2;
  const canSkipTwo = depth >= 3;

  const handlePush = () =>
    navigate.push("/heavy/:cpuMs/:nodes", heavyParams, { transitionName: "cupertino" });

  const handleSeed = async () => {
    while (useHistoryStore.getState().histories.length < SEED_DEPTH) {
      await navigate.push("/heavy/:cpuMs/:nodes", heavyParams, { transitionName: "cupertino" });
    }
  };

  const handlePushSkipTwo = () =>
    navigate.push("/heavy/:cpuMs/:nodes", heavyParams, { skip: 2, transitionName: "cupertino" });
  const handleReplaceSkipTwo = () =>
    navigate.replace("/heavy/:cpuMs/:nodes", heavyParams, { skip: 2, transitionName: "cupertino" });
  const handlePopSkipTwo = () => navigate.pop({ skip: 2 });
  const handlePopToLibrary = () => navigate.pop({ until: "/" });
  // The seeded screens were pushed with cupertino; popping back with an explicit
  // `material` proves the back transition can be overridden, and that the
  // screens' own cupertino never flashes during the collapse.
  const handlePopToLibraryMaterial = () => navigate.pop({ until: "/", transitionName: "material" });

  return (
    <PlaygroundToggleCard>
      <PlaygroundToggleCardHeader
        eyebrow="Navigation distance"
        title={t.title}
        description={t.description}
      />

      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-layer)] px-3 py-2">
        <span className="text-[12px] font-medium text-[var(--color-text-secondary)]">
          {t.stackDepth}
        </span>
        <span
          data-testid="nav-demo-depth"
          className="font-mono text-[13px] tabular-nums text-[var(--color-text-primary)]"
        >
          {depth}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="nav-demo-seed"
          onClick={handleSeed}
          className={buttonClassName}
        >
          {t.seed}
        </button>
        <button
          type="button"
          data-testid="nav-demo-push"
          onClick={handlePush}
          className={buttonClassName}
        >
          push
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          {t.reachBack} {canSkipTwo ? "" : t.seedFirst}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="nav-demo-pop-skip2"
            onClick={handlePopSkipTwo}
            disabled={!canSkipTwo}
            className={buttonClassName}
          >
            pop {"{ skip: 2 }"}
          </button>
          <button
            type="button"
            data-testid="nav-demo-replace-skip2"
            onClick={handleReplaceSkipTwo}
            disabled={!canSkipTwo}
            className={buttonClassName}
          >
            replace {"{ skip: 2 }"}
          </button>
          <button
            type="button"
            data-testid="nav-demo-push-skip2"
            onClick={handlePushSkipTwo}
            disabled={!canSkipTwo}
            className={buttonClassName}
          >
            push {"{ skip: 2 }"}
          </button>
          <button
            type="button"
            data-testid="nav-demo-pop-until-root"
            onClick={handlePopToLibrary}
            disabled={!canPopOne}
            className={buttonClassName}
          >
            pop {'{ until: "/" }'}
          </button>
          <button
            type="button"
            data-testid="nav-demo-pop-until-root-material"
            onClick={handlePopToLibraryMaterial}
            disabled={!canPopOne}
            className={buttonClassName}
          >
            pop {'{ until: "/", transitionName: "material" }'}
          </button>
        </div>
      </div>
    </PlaygroundToggleCard>
  );
}

export default PlaygroundNavigationCard;

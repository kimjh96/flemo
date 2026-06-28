"use client";

import { useHistoryStore, useNavigate } from "@flemo/react";

import { SHIFLO_SHOTS } from "../../_data/shifloShots";

// Page dots for the shiflo viewer. They persist below the <Slot> (so they don't
// re-animate as shots slide) and drive the nested Router directly via
// useNavigate. The active shot is read from the current history frame's `n`
// param; jumping picks the shared-axis direction from the index delta.
function ShotDots() {
  const navigate = useNavigate();
  const current = useHistoryStore((state) =>
    Number((state.histories[state.index]?.params as { n?: string } | undefined)?.n ?? "1")
  );

  const handleJump = (target: number) => {
    if (target === current) return;
    navigate.replace(
      "/shiflo-shot/:n",
      { n: String(target) },
      { transitionName: target > current ? "shared-axis-forward" : "shared-axis-backward" }
    );
  };

  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
      {SHIFLO_SHOTS.map((shot) => {
        const active = shot.id === current;
        return (
          <button
            key={shot.id}
            type="button"
            onClick={() => handleJump(shot.id)}
            aria-label={`${shot.id}`}
            aria-current={active ? "true" : undefined}
            className={`h-1.5 cursor-pointer rounded-full transition-all ${
              active ? "w-5 bg-[var(--color-primary)]" : "w-1.5 bg-white/60 backdrop-blur-sm"
            }`}
          />
        );
      })}
    </div>
  );
}

export default ShotDots;

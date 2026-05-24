import type { ReactNode } from "react";

export interface PlaygroundFrameProps {
  children: ReactNode;
}

// `transform: translateZ(0)` on the inner surface makes it the containing
// block for `position: fixed` descendants. Without it, flemo's `<Screen>`
// — which is internally `position: fixed; width: 100%; height: 100%` —
// would attach to the viewport and paint over the toggle panel below.
function PlaygroundFrame({ children }: PlaygroundFrameProps) {
  return (
    <div className="relative mx-auto">
      {/* Drop shadow halo */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 rounded-[44px] bg-[var(--color-ink)]/8 blur-2xl"
      />
      <div className="relative h-[680px] w-[320px] rounded-[44px] bg-[var(--color-ink)] p-[5px] shadow-[0_30px_80px_-30px_rgba(15,19,27,0.45)] ring-1 ring-black/40">
        {/* Inner screen surface — also the containing block for fixed children */}
        <div
          className="relative h-full w-full overflow-hidden rounded-[40px] bg-[var(--color-surface)]"
          style={{ transform: "translateZ(0)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default PlaygroundFrame;

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
      <div className="relative h-[680px] w-[320px] rounded-[44px] bg-[var(--color-ink)] p-[5px] ring-1 ring-[var(--color-ink)]/40">
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

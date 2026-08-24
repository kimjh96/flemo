import type { PropsWithChildren } from "react";

export interface StageFrameProps extends PropsWithChildren {
  /** The DOM marker the fixture is found by, so each bench keeps its own. */
  marker: "playground" | "chain";
  /** What this bench is for, read out beside the frame. */
  caption: string;
}

// The bench a fixture runs on.
//
// Deliberately plain: a bezel, a border, one shadow, and nothing that moves.
// This page is where flemo's motion is JUDGED, and every gram of decoration
// inside the frame is main-thread work landing in the same frames as the thing
// being looked at — a blurred backdrop or a drifting gradient behind the stage
// would change the measurement rather than dress it. The hero's glass bezel is
// the same shape at 34px, so the two read as one family; what is left out here
// is the blur.
//
// The size is the fixture's, not the page's: 380x720 is a phone's proportions,
// which is what a screen transition is authored for, and the frame clips like
// one so an element flying past the edge is caught here rather than at the
// window's.
function StageFrame({ marker, caption, children }: StageFrameProps) {
  return (
    <figure className="m-0 flex flex-col items-center gap-3">
      <div
        className="relative h-[720px] w-full max-w-[380px] overflow-hidden rounded-[34px] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[0_34px_80px_-30px_rgba(15,23,42,0.35)]"
        data-playground-stage={marker === "playground" ? "" : undefined}
        data-chain-stage={marker === "chain" ? "" : undefined}
      >
        {children}
      </div>
      <figcaption className="text-center text-xs text-[var(--color-text-disabled)]">
        {caption}
      </figcaption>
    </figure>
  );
}

export default StageFrame;

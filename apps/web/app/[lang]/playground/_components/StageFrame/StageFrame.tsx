import type { PropsWithChildren } from "react";

export interface StageFrameProps extends PropsWithChildren {
  /** The DOM marker the fixture is found by, so each bench keeps its own. */
  marker: "playground" | "chain";
}

// The glass window the fixtures run in, and the same one the landing hero uses:
// a colour field, a frosted bezel over it, and the app clipped inside. The
// playground is the page where flemo's motion is judged, so it should look like
// the page where flemo's motion is sold.
//
// The one thing left out of the hero's version is MOTION. Nothing here rolls,
// drifts or auto-plays: a page that animates while a flight is being judged
// changes the measurement instead of dressing it. The blob and the frost are
// static, which costs one raster and never repeats.
//
// The height tracks the viewport rather than being fixed at 720px, so the glass
// is on screen the moment the page is, on a laptop as well as a desktop. The
// proportions stay a phone's, which is what a screen transition is authored for.
function StageFrame({ marker, children }: StageFrameProps) {
  return (
    <div className="relative mx-auto w-fit">
      <div
        aria-hidden="true"
        className="absolute -top-12 -left-16 z-0 h-[112%] w-[130%] rounded-[45%] opacity-45 blur-[64px]"
        style={{ background: "var(--gradient-blob)" }}
      />
      <div className="relative h-[min(720px,calc(100dvh-13rem))] aspect-[380/720] rounded-[34px] border border-white/30 bg-white/10 p-1.5 shadow-[0_34px_80px_-26px_rgba(15,23,42,0.55)] backdrop-blur-2xl">
        <div
          className="h-full overflow-hidden rounded-[28px] bg-[var(--color-bg)]"
          data-playground-stage={marker === "playground" ? "" : undefined}
          data-chain-stage={marker === "chain" ? "" : undefined}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default StageFrame;

import type { PropsWithChildren } from "react";

export interface StageFrameProps extends PropsWithChildren {
  /** The DOM marker the stage is found by. */
  marker: string;
}

// The glass window the app runs in, and the same one the landing hero uses.
//
// The site's visual language stays, because a judging bench that looks like
// nothing else on the site is a page a visitor does not trust. What goes is the
// hero's LAYOUT — the kicker, the display headline, the 1fr/0.95fr split — which
// the old playground copied wholesale and which made this read as a second
// landing page rather than a bench.
//
// The one thing deliberately left out of the hero's version is MOTION. Nothing
// here rolls, drifts or auto-plays: a page that animates while a flight is
// being judged is changing the measurement rather than dressing it. The blob
// and the frost are static, which costs one raster and never repeats.
//
// Nothing is drawn INSIDE the frame that is not the app. The old stage carried
// a debug strip above the tab bar and another below it, clipping the app's own
// content; the readout now lives under the frame. A device with developer
// telemetry welded to its chassis cannot answer "does this feel native".
function StageFrame({ marker, children }: StageFrameProps) {
  return (
    <div className="relative w-fit">
      <div
        aria-hidden="true"
        className="absolute -top-10 -left-14 z-0 h-[110%] w-[128%] rounded-[45%] opacity-40 blur-[64px]"
        style={{ background: "var(--gradient-blob)" }}
      />
      {/* The height tracks the viewport rather than being fixed, so the whole
          device is on screen the moment the page is, on a laptop as well as a
          desktop. The subtraction is the page's own top padding plus its
          bottom padding — get it wrong and the frame is clipped by the fold,
          which no amount of styling inside it can fix. */}
      <div className="relative aspect-[380/760] h-[min(720px,calc(100dvh-11rem))] rounded-[38px] border border-white/30 bg-white/10 p-1.5 shadow-[0_34px_80px_-26px_rgba(15,23,42,0.55)] backdrop-blur-2xl">
        <div
          className="h-full overflow-hidden rounded-[32px] bg-[var(--color-bg)]"
          data-playground-stage={marker}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default StageFrame;

import type { PropsWithChildren } from "react";

// The glass bezel the mini-app runs in: the same one the landing hero uses, so
// the judging page belongs to the site it is part of.
//
// Nothing inside the bezel moves on its own. A page that animates while a
// flight is being judged changes the measurement rather than dressing it; the
// blob and the frost are one static raster.
//
// THE BLOB MUST OWN ITS LAYER. It overlaps the bezel, and WebKit paints an
// unpromoted element into the backing it shares with what it overlaps. Every
// flight inside the bezel promotes and demotes screen layers at its first and
// last frame, and each time WebKit re-rastered the blob's 64px blur on the main
// thread: measured in WebKit at 2x as 50-80ms at a pop's start and 66-87ms at
// its landing, on a plain cupertino pop with no morph in it, while removing
// the blob or promoting it read 0ms. `will-change: transform` keeps it on its
// own layer, so the blur is rendered once and the flight never touches it.
function Stage({ children }: PropsWithChildren) {
  return (
    <div className="relative w-fit">
      <div
        aria-hidden="true"
        className="absolute -top-10 -left-14 z-0 h-[110%] w-[128%] rounded-[45%] opacity-40 blur-[64px] will-change-transform"
        style={{ background: "var(--gradient-blob)" }}
      />
      <div className="relative aspect-[380/760] h-[min(720px,calc(100dvh-11rem))] rounded-[38px] border border-white/30 bg-white/10 p-1.5 shadow-[0_34px_80px_-26px_rgba(15,23,42,0.55)] backdrop-blur-2xl">
        <div
          className="h-full overflow-hidden rounded-[32px] bg-[var(--color-bg)]"
          data-playground-stage=""
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default Stage;

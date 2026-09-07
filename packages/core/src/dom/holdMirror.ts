import { ANIM_HOLD, ANIM_HOLD_ATTR } from "@dom/attributes";

// PUTTING A LAYER BACK UNDER THE HOLD ITS SCREEN IS UNDER.
//
// A layer sits outside the screens, so the compiled hold rule cannot reach what
// it carries through one. Both layers this engine lifts into — the morph's and
// the bar parts' — mirror the screen's hold attribute onto themselves, which is
// what keeps what they carry starting on the same frame as the flight around it
// rather than on a clock of its own.
//
// A HOLD IS A PAUSE, SO THE STRONGEST ONE WINS: while any source is still held,
// the flight has not been let go.
//
// AND A SOURCE THAT HAS LEFT THE DOCUMENT IS NOT STILL HOLDING, it is gone. A
// screen that unmounts mid-flight keeps whatever hold it wore, and an attribute
// observer on a removed node never fires again, so the mirror went on reading
// the value that screen left wearing. What it carried stayed paused at time
// zero for the whole flight and was then cut into place by a backstop.
//
// Reported on a `none` pop, where a transition with no clock of its own takes
// the departing screen out inside the same frame it was held in. Every
// transition with a clock hides it, because the screen it holds outlives its
// own release. Both layers had it; one copy of the arithmetic is how they stop
// having it separately.

export interface HoldMirror {
  /** Re-read the sources and write the result. Safe to call at any time. */
  readonly sync: () => void;
  /** Stop watching. The layer's attribute is the caller's to clear. */
  readonly disconnect: () => void;
}

/**
 * Mirror the strongest hold among `sources` onto `layer`, and keep mirroring
 * it until the returned handle is disconnected.
 *
 * `sources` are the elements carrying the hold — the box a screen is mounted
 * in, not the screen's own contents. A source that leaves the document reads
 * as released.
 */
export const mirrorHold = (layer: HTMLElement, sources: readonly HTMLElement[]): HoldMirror => {
  const sync = () => {
    const held = sources
      .filter((element) => element.isConnected)
      .map((element) => element.getAttribute(ANIM_HOLD_ATTR))
      .find((value) => value !== null && value !== ANIM_HOLD.RELEASED);
    layer.setAttribute(ANIM_HOLD_ATTR, held ?? ANIM_HOLD.RELEASED);
  };
  sync();

  const watch = typeof MutationObserver === "function" ? new MutationObserver(sync) : null;
  for (const element of sources) {
    watch?.observe(element, { attributes: true, attributeFilter: [ANIM_HOLD_ATTR] });
    // The departure is watched where the source SITS, not on itself: a node
    // cannot report its own removal. The box a screen is mounted into outlives
    // it, which is what makes the removal observable at all.
    /* v8 ignore next -- a hold is resolved with `closest` from an element in
       the tree, so the only parentless answer it could give is the document
       element, which the engine never writes a hold onto. */
    if (element.parentElement) {
      watch?.observe(element.parentElement, { childList: true });
    }
  }

  return { sync, disconnect: () => watch?.disconnect() };
};

export default mirrorHold;

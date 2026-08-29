import type { NavigateStatus, NavigateStoreApi } from "@navigate/store";

import { invertEasing } from "@transition/cubicBezier";

import { morphTraceArmed } from "@core/engine/diagnosticFlags";

import {
  clearGestureDeliveries,
  heldFlights,
  markGestureDelivered,
  stageHeldFlights,
  type MorphFlight
} from "@morph/attachMorph";

// A MORPH THE FINGER DRIVES.
//
// Every other flight in flemo is clocked by the compiled hold: the engine
// pauses the animations, flips one attribute, and the browser runs them. A drag
// has neither half of that. The navigation does not exist yet — a swipe commits
// on release, if at all — so there is no status to stage from, and there is no
// hold attribute to mirror, so nothing would pause them.
//
// What a drag DOES have is the one thing an interactive morph is usually
// missing: both ends are already on screen. The screen a back-swipe returns to
// is mounted underneath the one being dragged, so the destination rect can be
// measured at the first pointer move — the same measurement a programmatic
// flight takes at the status flip.
//
// So the gesture stages the flights itself, holds them at zero, and moves them
// by hand. It runs NO frame loop: the animations are the browser's own, and the
// pointer event sets their time. On release they are handed back to the
// browser — played forward to commit, or backwards to put the element home —
// at whatever speed the release settled the screens at.
//
// The scrub reaches every animation of the flight through the DOM rather than
// through the flight record, because a flight is more than its element: the
// ghost carrying the departure's content, the cut on the element left behind,
// the camera on a `carry: "screen"` zoom, and any nested morph riding the
// container are all separate animations that have to move on one clock. They
// share a namespace, which is what makes that collection exact.
const MORPH_ANIMATION_PREFIX = "flemo-morph-";

const isMorphAnimation = (animation: Animation): boolean => {
  const name = (animation as unknown as { animationName?: unknown }).animationName;
  return typeof name === "string" && name.startsWith(MORPH_ANIMATION_PREFIX);
};

// The gesture's own decisions, on the same buffer the flight runtime writes to
// (`flemo:morph=on`). A drag is the one path with no status flip behind it, so
// nothing else in the trace says whether it staged, moved, or was handed back.
const traceSwipe = (why: string, extra?: unknown): void => {
  if (!morphTraceArmed()) return;
  const host = globalThis as unknown as { flemoMorphTrace?: unknown[] };
  const log = (host.flemoMorphTrace ??= []);
  log.push({ why, id: "swipe", status: "DRAG", extra, t: Math.round(performance.now()) });
  if (log.length > 500) log.shift();
};

const morphAnimations = (): Animation[] => {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") return [];
  return document.getAnimations().filter(isMorphAnimation);
};

export interface MorphSwipe {
  /** Move every staged flight to this fraction of its travel (0 → 1). */
  scrub: (progress: number) => void;
  /**
   * Hand the flights back to the browser.
   *
   * `commit` plays them out to the arrival — the gesture became a navigation.
   * Otherwise they run BACKWARDS to where they started and the elements go
   * home, which is the only way back: a flight that is merely stopped leaves
   * the element in the layer, outside the tree its consumer wrote.
   */
  settle: (commit: boolean, seconds: number) => void;
  /** Whether anything is actually flying (a screen pair with no shared element is not). */
  readonly active: boolean;
}

/**
 * Stage the flights for a gesture and return the handle that drives them.
 *
 * `status` is the direction the gesture WOULD commit — `"POPPING"` for a
 * back-swipe — because the pairing reads it to decide which side is arriving.
 */
export const beginMorphSwipe = (
  store: NavigateStoreApi,
  status: NavigateStatus = "POPPING"
): MorphSwipe => {
  let released = false;

  // A new gesture supersedes whatever the last one left behind.
  clearGestureDeliveries(store);
  stageHeldFlights(store, status);
  traceSwipe("swipe-begin", { flights: heldFlights(store).length });

  // THE PARTNER CAN BE ONE FRAME YOUNGER THAN THE GESTURE.
  //
  // Staging pairs the element under the finger with its twin on the screen
  // underneath, and only the ARRIVING side starts a flight — on a back-swipe
  // that is the covered screen's. But the drag's first move is also what wakes
  // that screen: the binding flips its drag status, React re-renders it, and
  // its <Morph> children re-register in the commit that follows. Stage before
  // that commit and the map holds only the dismissing screen's elements, every
  // one of them `not-arriving`, and the gesture carries nothing: the shared
  // element sits still through the whole drag and then makes the trip on its
  // own once the navigation lands, long after the screens have stopped.
  //
  // So an empty first pass is retried on the next FRAME. A microtask is too
  // early — it runs before React commits, which is the thing being waited for.
  // A pass that staged anything is left alone; re-running it would be a no-op
  // (`already-flying`) but the frame of delay is not worth spending.
  if (heldFlights(store).length === 0) {
    requestAnimationFrame(() => {
      if (released || heldFlights(store).length > 0) return;
      stageHeldFlights(store, status);
      traceSwipe("swipe-restage", { flights: heldFlights(store).length });
      holdAt(0);
    });
  }

  // The container's own clock. Nested flights ride it by construction (same
  // duration, same start), so one flight's timing drives the whole set.
  const clockOf = (): MorphFlight | null => heldFlights(store)[0] ?? null;

  // The flight's own safety net is set for the flight's own length. A finger
  // does not keep to it — a slow drag outlives it easily — and letting it fire
  // lands the element back in its screen halfway through the gesture, which is
  // exactly what it looks like: the shared element shrinks with the drag and
  // then vanishes home. So the net goes away for as long as the gesture holds
  // the flight, and is set again for the release.
  const suspendBackstops = () => {
    for (const flight of heldFlights(store)) flight.suspendBackstop();
  };

  const holdAt = (seconds: number) => {
    suspendBackstops();
    for (const animation of morphAnimations()) {
      animation.pause();
      try {
        animation.currentTime = seconds * 1000;
      } catch {
        // An animation with no resolved timeline yet refuses the seek. It will
        // be seeked again on the next pointer move, which is 16ms away.
      }
    }
  };

  // Nested flights are staged one microtask late (a container has to decline or
  // start before the morphs inside it know which they are), so the first hold
  // has to be repeated once they exist — otherwise they run free while the
  // container waits for the finger.
  holdAt(0);
  queueMicrotask(() => holdAt(0));

  // The last thing the gesture asked for, so a settle can say whether the drag
  // was reaching the scrub at all.
  let lastAsked: number | null = null;
  let scrubs = 0;

  return {
    get active() {
      return clockOf() !== null;
    },
    scrub: (progress: number) => {
      if (released) return;
      const flight = clockOf();
      if (!flight) return;
      const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress;
      lastAsked = clamped;
      scrubs += 1;
      // The drag names how far along the element should LOOK, not where its
      // clock should be. Those are the same number only for a linear ease;
      // under the built-in curve a finger a tenth of the way across moves the
      // element a fiftieth, and the release is left to rush the rest.
      holdAt(flight.start + invertEasing(flight.ease)(clamped) * flight.duration);
    },
    settle: (commit: boolean, seconds: number) => {
      if (released) return;
      released = true;
      const flight = clockOf();
      if (!flight) {
        traceSwipe("swipe-settle-no-flight", { commit, seconds });
        return;
      }
      const animations = morphAnimations();
      const span = Math.max(seconds, 1 / 60);
      traceSwipe("swipe-settle", {
        commit,
        seconds,
        flights: heldFlights(store).length,
        animations: animations.length,
        at: (animations[0]?.currentTime as number | null) ?? null,
        scrubs,
        lastAsked,
        duration: flight.duration,
        start: flight.start
      });
      // A COMMIT delivers these elements itself: the release plays them out to
      // the arrival, and the navigation this commits will stage a moment later.
      // Whether its staging finds them still flying is a race the release speed
      // decides — a flick lands them first — so tell it they are already
      // delivered rather than leave it to timing.
      if (commit) markGestureDelivered(store);
      // Handed back to the browser, so the net goes back up — sized to the
      // release, not to the flight the gesture never ran.
      for (const held of heldFlights(store)) held.armBackstop(span);
      // The remaining travel decides the RATE, so a release near either end
      // lands as quickly as the screens do rather than replaying a whole
      // flight's worth of clock.
      const now = ((animations[0]?.currentTime as number | null) ?? 0) / 1000;
      const total = flight.start + flight.duration;
      const remaining = commit ? Math.max(total - now, 0) : Math.max(now, 0);
      const rate = remaining > 0 ? remaining / span : 1;
      for (const animation of animations) {
        // `play()` on a FINISHED animation rewinds it. That is the spec — an
        // exhausted animation replays from its start — and it is wrong for
        // every passenger of a flight that is already done with its own span:
        // the departure's cut is 17ms long and finished before the finger let
        // go, so handing the flight back replayed it, and the element that had
        // been cut came back opaque for a frame before cutting again. Its time
        // is kept and put back after the play.
        const at = animation.currentTime;
        animation.playbackRate = commit ? rate : -rate;
        // Backwards, an animation finishes at its start and fires no
        // `animationend` — the landing listens for one, so the flights are
        // brought home explicitly instead.
        if (!commit) {
          animation.addEventListener(
            "finish",
            () => {
              for (const held of heldFlights(store)) held.finish();
            },
            { once: true }
          );
        }
        animation.play();
        try {
          animation.currentTime = at;
        } catch {
          // A timeline that refuses the seek leaves the play as it landed.
        }
      }
    }
  };
};

export default beginMorphSwipe;

import type { NavigateStatus, NavigateStoreApi } from "@navigate/store";

import {
  holdScrubAt,
  placeLeg,
  returnLegSeek,
  scrubTo,
  settleScrubbed,
  stageReturnLeg,
  type ReturnLeg
} from "@transition/gestureScrub";

import {
  clearGestureDeliveries,
  heldTransitions,
  markGestureDelivered,
  stageHeldTransitions,
  type MorphRun
} from "@morph/attachMorph";
import { declaredMorphKeyframes } from "@morph/morphSheet";

// A MORPH THE FINGER DRIVES.
//
// Every other transition in flemo is clocked by the compiled hold: the engine
// pauses the animations, flips one attribute, and the browser runs them. A drag
// has neither half of that. The navigation does not exist yet — a swipe commits
// on release, if at all — so there is no status to stage from, and there is no
// hold attribute to mirror, so nothing would pause them.
//
// What a drag DOES have is the one thing an interactive morph is usually
// missing: both ends are already on screen. The screen a back-swipe returns to
// is mounted underneath the one being dragged, so the destination rect can be
// measured at the first pointer move — the same measurement a programmatic
// transition takes at the status flip.
//
// So the gesture stages the transitions itself, holds them at zero, and moves them
// by hand. It runs NO frame loop: the animations are the browser's own, and the
// pointer event sets their time. On release they are handed back to the browser
// at whatever speed the release settled the screens at: a commit resumes the
// transition, and a cancel plays the return leg staged alongside it.
//
// The scrub reaches every animation of the transition through the DOM rather than
// through the transition record, because a transition is more than its element: the
// ghost carrying the departure's content, the cut on the element left behind,
// the camera on a `carry: "screen"` zoom, and any nested morph riding the
// container are all separate animations that have to move on one clock. They
// share a namespace, which is what makes that collection exact.
const MORPH_ANIMATION_PREFIX = "flemo-morph-";

const isMorphAnimation = (animation: Animation): boolean => {
  const name = (animation as unknown as { animationName?: unknown }).animationName;
  return typeof name === "string" && name.startsWith(MORPH_ANIMATION_PREFIX);
};

const morphAnimations = (): Animation[] => {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") return [];
  return document.getAnimations().filter(isMorphAnimation);
};

export interface MorphSwipe {
  /** Move every staged shared element to this fraction of its path (0 → 1). */
  scrub: (progress: number) => void;
  /**
   * Let the browser finish the transitions.
   *
   * `commit` plays them to the end on the new screen: the swipe goes back and
   * becomes a navigation. Otherwise they play in REVERSE, along the same path,
   * and the elements return to their own place in the tree. A transition that
   * is merely stopped would leave the element in the morph layer, outside the
   * tree its consumer wrote.
   */
  settle: (commit: boolean, seconds: number) => void;
  /** Whether anything is actually moving (a screen pair with no shared element is not). */
  readonly active: boolean;
}

/**
 * Stage the transitions for a gesture and return the handle that drives them.
 *
 * `status` is the navigation the gesture would complete (`"POPPING"` for a
 * back-swipe), because the pairing reads it to decide which side is the new
 * screen.
 */
export const beginMorphSwipe = (
  store: NavigateStoreApi,
  status: NavigateStatus = "POPPING"
): MorphSwipe => {
  let released = false;

  // A new gesture supersedes whatever the last one left behind.
  clearGestureDeliveries(store);
  stageHeldTransitions(store, status);

  // THE PARTNER CAN BE ONE FRAME YOUNGER THAN THE GESTURE.
  //
  // Staging pairs the element under the finger with its twin on the screen
  // underneath, and only the ARRIVING side starts a transition — on a back-swipe
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
  // (`already-moving`) but the frame of delay is not worth spending.
  if (heldTransitions(store).length === 0) {
    requestAnimationFrame(() => {
      if (released || heldTransitions(store).length > 0) return;
      stageHeldTransitions(store, status);
      holdAt(0);
    });
  }

  // The container's own clock. Nested transitions ride it by construction (same
  // duration, same start), so one transition's timing drives the whole set.
  const clockOf = (): MorphRun | null => heldTransitions(store)[0] ?? null;

  // The transition's own safety net is set for the transition's own length. A finger
  // does not keep to it — a slow drag outlives it easily — and letting it fire
  // lands the element back in its screen halfway through the gesture, which is
  // exactly what it looks like: the shared element shrinks with the drag and
  // then vanishes home. So the net goes away for as long as the gesture holds
  // the transition, and is set again for the release.
  const suspendBackstops = () => {
    for (const transition of heldTransitions(store)) transition.suspendBackstop();
  };

  // THE RETURN IS STAGED WITH THE DRAG, NOT BUILT AT THE RELEASE.
  //
  // A cancel handed back with a negative playback rate replays the curve's
  // OPENING, which is its own tangent: the shared element came home at a dead
  // constant speed while the screens around it decelerated on the author's own
  // curve. So each animation's return leg is staged here, parked out of effect,
  // and the release only seeks and plays it (see @transition/gestureScrub).
  //
  // Kept per source animation, including the ones that decline: a transition has
  // several channels — the ghost, the cut, the camera, any nested morph — and
  // a `null` here is the record that this one is handed back the old way.
  const returns = new Map<Animation, ReturnLeg | null>();
  const stageReturns = () => {
    if (released) return;
    for (const animation of morphAnimations()) {
      if (returns.has(animation)) continue;
      // The path as the emitter wrote it: an engine that answers a compiled
      // animation without its custom properties would otherwise stage a leg
      // that moves nothing (see declaredMorphKeyframes).
      returns.set(animation, stageReturnLeg(animation, declaredMorphKeyframes(animation)));
    }
  };

  const dropReturns = () => {
    for (const leg of returns.values()) leg?.animation.cancel();
    returns.clear();
  };

  const holdAt = (seconds: number) => {
    suspendBackstops();
    holdScrubAt(morphAnimations(), seconds);
    stageReturns();
  };

  // Nested transitions are staged one microtask late (a container has to decline or
  // start before the morphs inside it know which they are), so the first hold
  // has to be repeated once they exist — otherwise they run free while the
  // container waits for the finger.
  holdAt(0);
  queueMicrotask(() => holdAt(0));

  return {
    get active() {
      return clockOf() !== null;
    },
    scrub: (progress: number) => {
      if (released) return;
      const transition = clockOf();
      if (!transition) return;
      suspendBackstops();
      // A nested transition can begin at any point of the drag — a container has to
      // decline or start before the morphs inside it know which they are — so
      // the legs are taken as the animations appear rather than once at zero.
      stageReturns();
      scrubTo(morphAnimations(), transition, progress);
    },
    settle: (commit: boolean, seconds: number) => {
      if (released) return;
      released = true;
      const transition = clockOf();
      if (!transition) {
        return;
      }
      const animations = morphAnimations();
      const span = Math.max(seconds, 1 / 60);
      // A COMMIT delivers these elements itself: the release plays them out to
      // the arrival, and the navigation this commits will stage a moment later.
      // Whether its staging finds them still moving is a race the release speed
      // decides — a flick lands them first — so tell it they are already
      // delivered rather than leave it to timing.
      if (commit) markGestureDelivered(store);
      // Handed back to the browser, so the net goes back up — sized to the
      // release, not to the transition the gesture never ran.
      for (const held of heldTransitions(store)) held.armBackstop(span);
      if (commit) {
        // A COMMIT IS THE TRANSITION ITSELF, RESUMED. Played forward from where the
        // finger left it, the animation walks the rest of the author's own
        // curve — the deceleration a cancel never reaches is exactly what is
        // ahead of it — and it lands on the `animationend` the transition is
        // already listening for. There is nothing a staged leg would add, and
        // running one instead would take that landing away.
        dropReturns();
        settleScrubbed(animations, transition, true, seconds);
        return;
      }
      const land = () => {
        for (const held of heldTransitions(store)) held.finish();
        // The transition has put the element back in its own tree; a leg still
        // holding its landed pose would wear the layer's pose there.
        dropReturns();
      };
      // Whatever declined a leg — a stepped handover, a host that dropped a
      // property — is handed back the way it always was.
      const backwards: Animation[] = [];
      for (const animation of animations) {
        const leg = returns.get(animation) ?? null;
        const seek = leg ? returnLegSeek(leg, animation) : null;
        if (!leg || !seek) {
          backwards.push(animation);
          continue;
        }
        // The finger's own animation stops where it is; the leg is what moves
        // from here, and a WAAPI animation outranks the compiled one it was
        // read from.
        animation.pause();
        leg.animation.addEventListener("finish", land, { once: true });
        placeLeg(leg.animation, seek.at, seek.remaining, seconds);
      }
      if (backwards.length > 0) settleScrubbed(backwards, transition, false, seconds, land);
    }
  };
};

export default beginMorphSwipe;

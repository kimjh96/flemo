import type { NavigateStatus } from "@navigate/store";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";

import { transitionMap } from "@transition/transition";

import type { TransitionName, TransitionVariant } from "@transition/typing";
import { resolveVariantMotion } from "@transition/variantMotion";

import isServer from "@utils/isServer";

import { resolveHeadKit } from "@core/engine/flightRouting";

import { TRANSITION_ATTR } from "@dom/attributes";

import {
  captureMorphSnapshot,
  readElementPose,
  untransformedCentre,
  untransformRect,
  type MorphRect
} from "@morph/morphGeometry";

/**
 * How long after the release the flight's motion actually begins, in seconds.
 *
 * The platform head kits bake a flat opening into a COPY of the screen's
 * keyframes so a commit that ages the wall clock eats the head instead of the
 * curve. A morph sits through the same head: its curve would otherwise be
 * swallowed by exactly the latency the head exists to cover.
 *
 * The governed tier waits TWO heads (its rule shifts `animation-delay` by the
 * head as well as holding one inside the keyframes); the desktop tier waits one.
 */
// Does this variant put the screen somewhere other than where it rests? Only
// the transform axes count: a screen that only fades carries the element's
// destination nowhere.
const MOVING_AXES = ["x", "y", "scale", "scaleX", "scaleY", "rotate"] as const;

const movesScreen = (target: TransitionTarget | undefined | null): boolean =>
  !!target && MOVING_AXES.some((axis) => target[axis] !== undefined && target[axis] !== 0);

export const headSeconds = (status: NavigateStatus): number => {
  if (isServer()) return 0;
  // From the ROUTING, not from the root's attribute. The engine announces the
  // head kit by stamping that attribute, and it does so from the same commit a
  // morph is staged in — after the morph, because React runs a descendant's
  // layout effect first. Reading it there answers with the PREVIOUS flight's
  // kit: right by luck from the second navigation on, and wrong on the first,
  // which is what made a first push run its element 33ms ahead of the screen
  // carrying it while every push after it was aligned. Same predicates, same
  // answer, no ordering to lose.
  const { governedHead, headMs } = resolveHeadKit(status);
  // The governed kit's flat head is counted twice: its keyframes carry the
  // head, and the engine's own deadlines ride it as well.
  return governedHead ? (headMs * 2) / 1000 : headMs / 1000;
};

export interface MorphSide {
  /**
   * Where the element's box belongs AT REST, in viewport coordinates.
   *
   * Not simply its measured rect: a screen mid-flight (or held at its from-pose)
   * carries a transform, and every rect measured inside it is displaced by it.
   * The travel has to be computed against the undisplaced box, or a push under a
   * sliding transition would aim a screen-width away from where the element ends.
   */
  rect: MorphRect;
  fontSize: number | null;
  fontWeight: number | null;
  letterSpacing: number | null;
  wordSpacing: number | null;
  lineHeight: number | null;
  aspectRatio: string | null;
  padding: string;
  margin: string;
  paint: Record<string, string>;
  /** Whether this end is one line of text (see MorphSnapshot.singleLine). */
  singleLine: boolean;
  /** This end's first text run height (see MorphSnapshot.textHeight). */
  textHeight: number | null;
  /** Where this end's line was actually rendered (see MorphSnapshot.leadOffset). */
  leadOffset: number | null;
  /**
   * Whether this screen's transition MOVES it — read from the DEFINITION, not
   * from the element: at the moment a flight is staged the arriving screen is
   * parked at its DESTINATION with no transform on it yet (`park-under`), so
   * asking the DOM answers no for every screen that is about to slide in.
   */
  screenMoves: boolean;
  /** The screen's own timing, so a morph that authors none lands with its screen. */
  screenDuration: number;
  screenEase: AnimationOptions["ease"];
}

/**
 * Where one side of a morph really is, and how long its screen takes.
 *
 * The screen is read from the DOM PROTOCOL — its transition name is an
 * attribute — rather than from a store, so a morph works the same for any
 * binding and needs nothing threaded through from the consumer's tree.
 */
export const resolveMorphSide = (
  element: HTMLElement,
  screen: HTMLElement,
  variant: TransitionVariant
): MorphSide => {
  const snapshot = captureMorphSnapshot(element);
  const inert: MorphSide = {
    rect: snapshot.rect,
    fontSize: snapshot.fontSize,
    fontWeight: snapshot.fontWeight,
    letterSpacing: snapshot.letterSpacing,
    wordSpacing: snapshot.wordSpacing,
    lineHeight: snapshot.lineHeight,
    aspectRatio: snapshot.aspectRatio,
    padding: snapshot.padding,
    margin: snapshot.margin,
    paint: snapshot.paint,
    singleLine: snapshot.singleLine,
    textHeight: snapshot.textHeight,
    leadOffset: snapshot.leadOffset,
    screenMoves: false,
    screenDuration: 0,
    screenEase: undefined
  };

  // The name comes off the DOM protocol, so it is a plain string — the registry
  // is keyed by the augmentable TransitionName union, which a consumer's own
  // transitions widen. The lookup is the validation: an unregistered name
  // simply resolves to nothing and the rect is taken as measured.
  const transitionName = screen.getAttribute(TRANSITION_ATTR) as TransitionName | null;
  const transition = transitionName ? transitionMap.get(transitionName) : undefined;
  if (!transition) return inert;

  const motion = resolveVariantMotion(transition, variant);
  if (!motion) return inert;

  // What the screen is WEARING, not what its variant says it should be: the
  // destination park rules hold an entering screen at its destination rather
  // than its from-pose, and correcting for a displacement that is not there
  // puts the arrival a screen away from anything.
  const pose = readElementPose(screen);
  const painted = screen.getBoundingClientRect();
  const centre = untransformedCentre(
    { x: painted.left, y: painted.top, width: painted.width, height: painted.height },
    pose
  );

  return {
    rect: untransformRect(snapshot.rect, pose, centre),
    fontSize: snapshot.fontSize,
    fontWeight: snapshot.fontWeight,
    letterSpacing: snapshot.letterSpacing,
    wordSpacing: snapshot.wordSpacing,
    lineHeight: snapshot.lineHeight,
    aspectRatio: snapshot.aspectRatio,
    padding: snapshot.padding,
    margin: snapshot.margin,
    paint: snapshot.paint,
    singleLine: snapshot.singleLine,
    textHeight: snapshot.textHeight,
    leadOffset: snapshot.leadOffset,
    screenMoves: movesScreen(motion.from) || movesScreen(motion.to),
    screenDuration: motion.duration,
    screenEase: motion.ease
  };
};

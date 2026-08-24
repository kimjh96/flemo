import type { BaseTransition, TransitionVariant } from "@transition/typing";

// User-augmentable registry of morph-transition names, mirroring
// RegisterTransition / RegisterDecorator / RegisterPartTransition. A consumer
// augments this to get typed `name` strings on `createMorphTransition` and on
// the binding's morph element.
// eslint-disable-next-line
export interface RegisterMorphTransition {}

export type MorphTransitionName =
  | RegisterMorphTransition[keyof RegisterMorphTransition]
  | "shared"
  | "text"
  | "zoom"
  | (string & {});

/** The preset every morph falls back to when no name is given. */
export const DEFAULT_MORPH_TRANSITION_NAME = "shared";

export type MorphTransitionOptions = {
  /**
   * The share of the flight over which the GHOST dissolves — the copy of the
   * element being replaced that the runtime carries inside the flight (0–1,
   * default 0.55).
   *
   * It is what makes a travel show the right thing at both ends: the flight
   * begins as an exact copy of what was on glass and dissolves into the real
   * arriving element while the box moves. Set it to 0 to carry no copy, which
   * cuts straight to the arrival's content on the first frame.
   *
   * The arriving element stays opaque underneath throughout. Fading both would
   * bleed the background through the pair by a(1 - a) — a luminance dip
   * peaking at 25% in the middle of the hand-over.
   *
   * THE WINDOW IS WHAT THE DEPARTURE'S OWN CONTENT LEAVES OVER. This used to be
   * 0.22 — three frames of a short flight — on the reasoning that holding the
   * copy longer let the two layouts drift apart underneath it and print as
   * doubled text. That reasoning was written when the copy painted everything,
   * including the paired elements. It does not now: a paired descendant is
   * already invisible in the copy (the real one is morphing underneath it), so
   * all the copy is holding is content with NO counterpart — a caption, a body
   * paragraph, a button that exists on one side only. Three frames is not that
   * content leaving; it is that content being cut, which is exactly what a pop
   * looked like next to the arrival it was supposed to reverse.
   */
  crossFade?: number;
  /**
   * Interpolate `border-radius` across the flight (default true). Nothing is
   * scaled, so the two ends' own values are the whole story.
   *
   * It rides the CONTENT animation, never the geometry one: a keyframe that
   * lists a property the compositor cannot animate drops that whole animation
   * to the main thread, and the geometry keyframe is the one that must never
   * leave the compositor.
   */
  radius?: boolean;
  /**
   * Move the whole screen with the element, not just the element (default off).
   *
   * A plain morph flies ALONE: the element crosses while the screens do
   * whatever their own transition says, which is right when the element is one
   * thing among many. It is wrong when the element IS the navigation — a grid
   * cell opening into a full-screen view. There the eye reads the tap as
   * "the camera moved to this card", and a grid that stays put underneath
   * reads as the card escaping from it.
   *
   * `"screen"` gives the flight a camera: the screen the element is SMALL on
   * (the grid — the departing screen on a push, the arriving one on a pop) is
   * scaled and translated by exactly the zoom that takes the element from one
   * end to the other, so every other card moves as though the viewport had
   * pushed in on the tapped one. Material calls the pattern a container
   * transform; iOS 18 calls its version a zoom transition.
   *
   * It SUPERSEDES that screen's own transform for the length of the flight —
   * the camera IS the screen's motion here, and two authors of one transform
   * is not a thing CSS can compose. Pair it with a transition that does not
   * move the screen itself (`none`, or an opacity-only one); a slide would be
   * replaced rather than combined.
   */
  carry?: "screen";
};

// A morph-transition is shaped exactly like a part-transition — `initial` plus
// the status×active variant table — so an author who has written one flemo
// transition has written them all. What differs is where the MOTION comes from:
// the geometry (how far the element travels and how much it grows) is measured
// per flight and composed by the runtime, so these targets describe everything
// ELSE — the fade, the tint, the radius, an optional transform flourish layered
// on top of the travel.
export interface MorphTransition extends Omit<BaseTransition, "name">, MorphTransitionOptions {
  name: MorphTransitionName;
}

// Where each side of a morph physically sits before its animation begins.
//
// This deliberately does NOT reuse the screen table (`FROM_VARIANT`). A screen
// entering on POP resumes the pose it retreated to, so its from-value is the
// PUSHING-false variant; a morph has no such continuity — the arriving element
// mounts fresh (or wakes from a freeze) on every status, and the element left
// behind is always at rest when the flight starts. So the arriving side always
// begins at `initial` and the departing side always begins at rest, whichever
// status brought them together.
export const MORPH_FROM_VARIANT: Record<TransitionVariant, "initial" | "IDLE-true" | "self"> = {
  "IDLE-true": "self",
  "IDLE-false": "self",
  "PUSHING-true": "initial",
  "PUSHING-false": "IDLE-true",
  "REPLACING-true": "initial",
  "REPLACING-false": "IDLE-true",
  // POP is the reversed pair (see createMorphTransition): the arriving side is
  // "-false" there, so that is the one starting from `initial`.
  "POPPING-true": "IDLE-true",
  "POPPING-false": "initial",
  "COMPLETED-true": "self",
  "COMPLETED-false": "self"
};

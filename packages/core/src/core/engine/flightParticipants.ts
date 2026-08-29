import { variantHasAnimation } from "@transition/compileTransitionStyles";
import type resolveTransition from "@transition/resolveTransition";
import type { TransitionVariant } from "@transition/typing";

import { resolveVariantMotion } from "@transition/variantMotion";

import {
  ACTIVE_ATTR,
  ANIM_HOLD_ATTR,
  attrSelector,
  attrValueSelector,
  PART_NAME_ATTR,
  ROUTER_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR
} from "@dom/attributes";

import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// WHO IS IN THIS FLIGHT.
//
// A navigation's choreography is not one element. It is the screen scope, its
// riding shared bars, the decorator, and every <Part> that mirrors the
// screen's status — spread across a DOM the engine does not own and cannot
// infer from structure (each screen sits in its own wrapper, a root Router
// renders no container at all, and two independent Routers may share a DOM
// parent). Every query that answers "who is participating" lives here, so the
// scoping rules are stated once instead of re-derived at each call site.

// This screen's <Part> elements. The container (the scope's parent) hosts
// bar-mounted parts too; parts owned by a NESTED screen inside the container
// belong to that screen's own engine and are excluded.

export const collectScreenParts = (scope: HTMLElement): HTMLElement[] => {
  const container = scope.parentElement ?? scope;
  return Array.from(container.querySelectorAll<HTMLElement>(`[${PART_NAME_ATTR}]`)).filter(
    (part) => {
      const owner = part.closest(attrSelector(SCREEN_ATTR));
      return !owner || owner === scope || !container.contains(owner);
    }
  );
};

// The subset currently mirroring this join's variant (parts self-carry their
// screen's status/active, which the compiled part selectors match on).
export const collectVariantParts = (
  scope: HTMLElement,
  variant: TransitionVariant
): HTMLElement[] => {
  const [status, active] = variant.split("-");
  return collectScreenParts(scope).filter(
    (part) => part.getAttribute(STATUS_ATTR) === status && part.getAttribute(ACTIVE_ATTR) === active
  );
};

// Pin the compiled promotions inline for one side of the flight (see
// layerSettleHold.ts): the screen scope, its riding shared bars (they run
// the screen's own rule, so they share its property list and containment),
// the decorator, and this side's <Part> elements — every element whose
// variant rule un-matching at the COMPLETED flip would demote-and-repaint a
// compositor layer on the convergence frames. Each participant is gated on
// its OWN definition's animation (a motionless screen can still carry an
// animating decorator or part — REVEAL-shaped transitions). Containment
// mirrors the rules' `contain: layout` scoping (PUSHING/REPLACING only).
// The WHOLE choreography's span for one status: the longest of the screen
// transition's BOTH variants (active and passive — either side may be the
// long-authored one) and every <Part> participating in this status. Any
// deadline meant to outlast "the flight" must derive from this, not from one
// screen's variant — the response hold's backstop learned that the hard way
// (a 700ms screen with a 3s Part flushed parked responses mid-Part).
// Parts participating in THIS Router's flight, by the EXPLICIT boundary
// marker: the React binding stamps every screen and shared bar with its
// owning Router's identity (`data-flemo-router`, see RouterIdContext). A
// document-global status query let an unrelated Router's 3s part inflate
// this navigation's gate, floor, and response backstop — and DOM-structure
// inference cannot draw the line: each screen sits in its own wrapper (so
// the two screens of ONE flight share no parent), a root Router renders no
// container at all, and two independent Routers may share a DOM parent.
// Marker semantics: a part qualifies when its nearest marked carrier
// (screen or bar) carries the SAME Router id as the scope's. Either side
// missing a marker (a binding predating the stamp, detached test fixtures)
// keeps the old inclusive behavior — over-waiting is a delay, cross-cutting
// is a truncation.
export const collectFlightParts = (scope: HTMLElement, status: string): HTMLElement[] => {
  const ownCarrier = scope.closest(attrSelector(ROUTER_ATTR));
  const flightId = ownCarrier?.getAttribute(ROUTER_ATTR) ?? null;
  return Array.from(
    scope.ownerDocument.querySelectorAll<HTMLElement>(
      `${attrSelector(PART_NAME_ATTR)}${attrValueSelector(STATUS_ATTR, status)}`
    )
  ).filter((part) => {
    if (flightId === null) return true;
    const carrier = part.closest(attrSelector(ROUTER_ATTR));
    if (!carrier) return true;
    return carrier.getAttribute(ROUTER_ATTR) === flightId;
  });
};

// Flight parts that no held element CONTAINS. The compiled hold rule pauses
// `[data-flemo-anim-hold=…]` and its `[data-flemo-part-name]` DESCENDANTS, so
// a Part inside a screen rides the screen's own hold and a Part inside a
// shared bar rides the bar's — the React binding stamps the attribute on
// both. A Part mounted OUTSIDE any screen has neither. <Part> supports that
// position deliberately (its own header: "a persistent header next to a
// <Slot>, a portal"), and the compiled part selector keys on name + status +
// active with NO structural term, so such a part is driven by this flight's
// keyframes while nothing pauses it: it animated straight through the hold
// window with every screen parked, then led the flight by the whole hold —
// the defect the decorator once had ("the dim faded in ahead of the held
// screens", 2026-08-13).
//
// Scoped through collectFlightParts, i.e. by the EXPLICIT `data-flemo-router`
// marker rather than DOM ancestry. That is not a preference: RouterIdContext
// exists precisely because structure cannot draw this boundary (a root Router
// renders no container, two Routers may share a parent), and each screen sits
// in its own wrapper — so a container-scoped walk from the scope reaches only
// this screen's own subtree, where every Part host is already held. It would
// find nothing that needs holding.
//
// The ancestor test deliberately starts at the PARENT: a part this engine has
// already stamped must still be found, so the release can re-derive the same
// set instead of trusting a record the DOM may have changed under.
export const collectUnheldOuterParts = (scope: HTMLElement, status: string): HTMLElement[] =>
  collectFlightParts(scope, status).filter(
    (part) => part.parentElement?.closest(`[${ANIM_HOLD_ATTR}]`) == null
  );

// The release sweep is deliberately status-AGNOSTIC while the stamp above is
// status-scoped. Stamping narrowly keeps the pause off parts this flight does
// not drive (`animation-play-state` is per-ELEMENT: it would pause whatever
// the consumer authored on that part too). Clearing broadly guarantees the
// pause cannot outlive the flight if the part's own status attribute moved in
// a different commit than this drive — a leak would freeze persistent chrome
// indefinitely, so the two sides must not share a predicate.
export const collectStampedOuterParts = (scope: HTMLElement): HTMLElement[] => {
  const flightId = scope.closest(attrSelector(ROUTER_ATTR))?.getAttribute(ROUTER_ATTR) ?? null;
  return Array.from(
    scope.ownerDocument.querySelectorAll<HTMLElement>(`[${PART_NAME_ATTR}][${ANIM_HOLD_ATTR}]`)
  ).filter((part) => {
    /* v8 ignore next -- a part reached by a document query always has a parent;
       the optional chain is a guard against a detached caller, not a path. */
    if (part.parentElement?.closest(`[${ANIM_HOLD_ATTR}]`) != null) return false;
    if (flightId === null) return true;
    const carrier = part.closest(attrSelector(ROUTER_ATTR));
    return !carrier || carrier.getAttribute(ROUTER_ATTR) === flightId;
  });
};

export const statusChoreographySpanMs = (
  scope: HTMLElement,
  transition: ReturnType<typeof resolveTransition>,
  status: string
): number => {
  let spanMs = 0;
  for (const variant of [`${status}-true`, `${status}-false`] as TransitionVariant[]) {
    if (!variantHasAnimation(transition, variant)) continue;
    // variantHasAnimation SUBSUMES resolveVariantMotion's gate: both require a
    // non-rest variant with duration or delay > 0 (variantMotion.ts), and
    // variantHasAnimation additionally requires that something interpolates.
    // So past the check the motion always resolves.
    const motion = resolveVariantMotion(transition, variant)!;
    spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
  }
  for (const part of collectFlightParts(scope, status)) {
    const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
    const partVariant = `${status}-${part.getAttribute(ACTIVE_ATTR)}` as TransitionVariant;
    if (!definition || !variantHasAnimation(definition, partVariant)) continue;
    const motion = resolveVariantMotion(definition, partVariant)!;
    spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
  }
  // The decorator is a full participant too (it joins the shared player): a
  // 3s custom dim over a 700ms screen must extend every flight deadline,
  // exactly like a long-authored Part.
  const decoratorDefinition = transition.decoratorName
    ? decoratorMap.get(transition.decoratorName)
    : undefined;
  if (decoratorDefinition) {
    for (const variant of [`${status}-true`, `${status}-false`] as TransitionVariant[]) {
      if (!variantHasAnimation(decoratorDefinition, variant)) continue;
      const motion = resolveVariantMotion(decoratorDefinition, variant)!;
      spanMs = Math.max(spanMs, (motion.delay + motion.duration) * 1000);
    }
  }
  return spanMs;
};

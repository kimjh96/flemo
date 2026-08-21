import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";

import type { SwipeAnimate } from "@transition/typing";

const isHTMLElement = (target: unknown): target is HTMLElement =>
  typeof HTMLElement !== "undefined" && target instanceof HTMLElement;

// A LEASE over every CSS property animateInline (or the engine) has written to
// a given element: property → the element's OWN inline value BEFORE flemo
// first wrote it ("" when it had none) plus the set of WRITERS currently
// staked on it. `clearInlineAnimation` RESTORES the captured value rather
// than blindly deleting the property, so a consumer's own inline
// `animation-delay: 0.2s` survives a transition that temporarily overwrote it
// — and a stale write from a superseded transition is cleaned by restoring
// the original, never inherited by the next one.
//
// WHY writers are tracked: two independent drivers can write the same
// property on the same element — a swipe gesture's release settle and the
// engine's player both drive a shared bar's transform when a navigation
// starts right after a cancelled swipe. A single-owner lease let whichever
// finished FIRST restore the original out from under the still-animating
// other (a visible snap to rest). An owner-scoped clear removes only that
// writer's stake and restores only when the LAST stake is gone; a clear with
// NO owner is the force form — the final authority (the engine's COMPLETED
// flip, the player's own teardown), where the flight is over by definition.
interface InlineLease {
  original: string;
  owners: Set<symbol>;
}
const inlineLeases = new WeakMap<HTMLElement, Map<string, InlineLease>>();

// The stake for callers that don't distinguish themselves (the player, the
// engine's recovery/snap writers). Their writes are always force-cleared by
// their own teardown paths, so a shared token is safe for them.
const GLOBAL_WRITER = Symbol("flemo-inline-writer");

// Who last wrote the element's inline `transition` (the instant path's
// "none", the no-WAAPI fallback's property list). The reset in
// clearInlineAnimation is scoped by it: writer A's cleanup must not clip a
// fallback transition writer B is still running on the same element.
const transitionWriters = new WeakMap<HTMLElement, symbol | undefined>();

// Register a lease BEFORE writing `property` inline: captures the element's
// current value as the original the FIRST time this property is leased
// (repeat writes — the player's per-frame transform — keep the first
// capture), and stakes `owner` on it. Exported for the rAF player and the
// engine's inline writers.
export const trackInlineWrite = (
  el: HTMLElement,
  property: string,
  owner: symbol = GLOBAL_WRITER
) => {
  let lease = inlineLeases.get(el);
  if (!lease) {
    lease = new Map<string, InlineLease>();
    inlineLeases.set(el, lease);
  }
  let entry = lease.get(property);
  if (!entry) {
    entry = { original: el.style.getPropertyValue(property), owners: new Set() };
    lease.set(property, entry);
  }
  entry.owners.add(owner);
};

// Conclude a running settle without writing values: a NAVIGATION owns its
// participants, and a settle still interpolating would pull toward its own
// target while the flight (or the player) writes the real pose. Exported for
// those two call sites; the instant-write path above concludes its own.
export const concludeInlineSettle = (el: HTMLElement, owner?: symbol) => {
  if (!isHTMLElement(el)) return;
  trackInlineWrite(el, "transition", owner);
  el.style.transition = "none";
  transitionWriters.set(el, owner);
};

// Drop any inline styles animateInline wrote (transform / opacity / filter /
// backgroundColor / ...) so the underlying CSS rules can take over (e.g.,
// after a swipe is cancelled, the CSS rest rule resumes). Pass an explicit
// `properties` list to override. Pass `owner` to release only that writer's
// stake — the property is restored only when no other writer still holds it;
// omit `owner` for the force form (the flight-over final authority).
export const clearInlineAnimation = (el: HTMLElement, properties?: string[], owner?: symbol) => {
  // A settle IS the inline `transition` reset below: dropping it concludes
  // the motion without writing anything, which is what a handoff to the rest
  // rules needs. The reset is owner-scoped — writer A's cleanup must not clip
  // a transition writer B is still running on the same element.
  const lease = inlineLeases.get(el);
  // Reset `transition` only under the force form or when THIS owner was its
  // last writer — the property itself is single-valued, so ownership of the
  // running transition is tracked explicitly.
  const mayResetTransition = !owner || transitionWriters.get(el) === owner;
  if (mayResetTransition) {
    el.style.transition = "";
    transitionWriters.delete(el);
  }
  const releaseProperty = (property: string) => {
    const entry = lease?.get(property);
    if (!entry) {
      // Untracked: only the force form may strip (an explicit-list caller
      // clearing a property it knows about); an owner-scoped clear never
      // touches what it has no stake in.
      if (!owner) el.style.removeProperty(property);
      return;
    }
    if (owner) {
      entry.owners.delete(owner);
      if (entry.owners.size > 0) return; // another writer still drives this
    }
    if (entry.original) el.style.setProperty(property, entry.original);
    else el.style.removeProperty(property);
    lease!.delete(property);
  };
  if (properties) {
    for (const property of properties) releaseProperty(property);
    return;
  }
  if (lease && lease.size > 0) {
    for (const property of [...lease.keys()]) releaseProperty(property);
    return;
  }
  // Untracked element (animateInline never wrote here): fall back to
  // stripping the two near-universal swipe targets so the contract stays
  // useful for callers that hand in an arbitrary element.
  if (!owner) {
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
  }
};

// Imperative replacement for Motion's `animate()` inside transition swipe
// handlers. Instant writes (duration 0 — the drag-follow path) mutate inline
// styles directly. Timed writes (the release settle) run on the settle
// scrubber's shared main-thread clock (see settleScrub.ts), falling back to
// an inline CSS `transition` where WAAPI is unavailable. Returns a Promise
// that resolves when the motion lands (never rejects).
const animateInline = (
  target: HTMLElement,
  value: Parameters<SwipeAnimate>[1],
  options: NonNullable<Parameters<SwipeAnimate>[2]> = {},
  // The writer staking these inline values (see the lease model above).
  // The swipe controller passes its instance token so its cleanup releases
  // only its own stake; unscoped callers share the global writer.
  writer?: symbol
) => {
  if (!isHTMLElement(target)) return Promise.resolve();
  const el = target;

  const decls = targetToDecls(value);
  if (decls.length === 0) return Promise.resolve();

  const duration = typeof options.duration === "number" ? options.duration : 0;
  const delay = typeof options.delay === "number" && options.delay > 0 ? options.delay : 0;
  const easing = easingToCss(options.ease);

  if (duration <= 0 && delay <= 0) {
    // A re-grab writes through here every pointermove: `transition: none` in
    // the same commit concludes any settle still running and takes the value
    // the finger asks for, so the motion departs from the finger, never from
    // a stale target.
    el.style.transition = "none";
    transitionWriters.set(el, writer);
    for (const d of decls) {
      trackInlineWrite(el, d.property, writer);
      el.style.setProperty(d.property, d.value);
    }
    return Promise.resolve();
  }

  // THE settle: an inline CSS transition, on every engine. It carries the
  // authored duration and easing and starts from the element's current
  // computed value, which is the one thing a release must do — a finger can
  // let go anywhere.
  //
  // It used to be a paused Web Animation whose currentTime was stepped from a
  // main-thread rAF clock (settleScrub, deleted with this change), for "the
  // same compositor-jank immunity as the transition player". That player is
  // retired, and the trade runs backwards where the main thread is the scarce
  // resource: device-reported on iOS in Low Power Mode, the release stuttered
  // along with the drag. Judged on glass against this same motion driven both
  // ways: on WebKit the compositor one is smooth and the scrubbed one is not,
  // and on Blink the two are indistinguishable — so there is no tier left to
  // keep, and no second mechanism to carry.
  const transitionList = decls
    .map((d) => `${d.property} ${duration}s ${easing} ${delay}s`)
    .join(", ");
  el.style.transition = transitionList;
  transitionWriters.set(el, writer);
  // Force a reflow so the new `transition` value is in effect before we set
  // the target values (some browsers otherwise coalesce property mutations).
  void el.offsetWidth;
  for (const d of decls) {
    trackInlineWrite(el, d.property, writer);
    el.style.setProperty(d.property, d.value);
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onEnd);
      resolve();
    };
    const onEnd = (event: TransitionEvent) => {
      if (event.target !== el) return;
      finish();
    };
    el.addEventListener("transitionend", onEnd);
    setTimeout(finish, (duration + delay) * 1000 + 60);
  });
};

export default animateInline;

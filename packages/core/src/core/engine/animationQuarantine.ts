// Consumer-animation quarantine, pose-preserving.
//
// WHY IT EXISTS (unchanged from the CSS-only first version): a cold entering
// screen can mount hundreds of consumer CSS animations — measured ~380
// accelerated shimmer loops on one feed screen — and every one of them owns a
// compositor layer while it EXISTS (paused or not). The release-time
// restructure then re-commits that whole subtree in one ~65ms composite,
// swallowing the transition's opening wholesale. Only non-existence
// (`animation: none`) prevents the layer storm, so during the flight the
// quarantine keeps every consumer animation non-existent.
//
// WHY IT IS NO LONGER CSS-ONLY: `animation: none` doesn't just stop motion —
// it erases the animation's POSE. An animation whose fill/delay gates
// visibility (the ubiquitous delayed-skeleton pattern: `reveal 180ms ease
// 500ms both`, transparent until 500ms) falls back to its base styles, so the
// element the author explicitly hid became fully visible for the whole
// flight, then BLINKED OUT at the landing when the rule lifted and the
// animation restarted from zero — measured on a production tab switch as the
// "entry delay": skeleton flash in flight → vanish at rest → half a second of
// authored re-delay → late reveal. A quarantine may relocate an animation's
// COST; it must never change what the author put on glass. Hence:
//
// 1. AT MOUNT (pre-paint, before the attribute lands): enumerate the
//    subtree's consumer animations and pin each real-element target to its
//    first-keyframe pose with inline styles. The first keyframe is what the
//    animation would show at t≈0 — for fill-gated reveals that is the
//    authored hidden pose, for entrance motion the authored start, for loops
//    the loop's start. The flight then presents the authored t≈0 pose with
//    ZERO live animations. (Pseudo-element animations can't take inline
//    styles; they keep the plain `animation: none` fallback — decorative
//    shimmer class, base pose ≈ first keyframe in practice.)
// 2. AT RELEASE (the landing commit, at rest — or immediately on interrupt):
//    lift the attribute, strip the inline pins, and REJOIN every snapshotted
//    animation to its original clock (`currentTime = now - mountTime`), as if
//    it had been running since mount. A delayed reveal is still inside its
//    authored delay — no restart, no blink, the reveal fires at the authored
//    absolute time. A loop lands mid-phase. A one-shot that would have
//    finished under the flight lands finished. Content that arrived during
//    the flight (its animations were never snapshotted) starts fresh at the
//    landing — begin-at-arrival, exactly as before.
//
// The compiled rule this pairs with keys on `data-flemo-quarantine`, stamped
// HERE (engine-owned; bindings never render it), so the attribute's lifetime
// exactly matches the snapshot's. Fresh-mount sides only (PUSHING/REPLACING
// enter) — the warm exit side and pop screens keep their animations, for the
// reasons documented on the compiled rule.

import { QUARANTINE_ATTR } from "@transition/compileTransitionStyles";

interface CompensatedPose {
  element: HTMLElement;
  // Property → the inline value that was there before the pin (restored on
  // release; almost always null).
  previous: Map<string, string>;
}

interface SnapshotEntry {
  target: Element;
  pseudoElement: string | null;
  animationName: string;
  // An authored `animation-play-state: paused` must not be seeked to the
  // shared clock — its authored pose IS the hold.
  paused: boolean;
}

// CSSAnimation with the subset of fields this module reads; typed locally so
// core carries no DOM-lib animation typings beyond what it uses.
interface CssAnimationLike extends Animation {
  animationName?: string;
}

const COMPILED_ANIMATION_PREFIX = "flemo-";

const isCssAnimation = (animation: Animation): animation is CssAnimationLike =>
  typeof (animation as CssAnimationLike).animationName === "string";

const animationTargets = (
  animation: CssAnimationLike
): { target: Element | null; pseudoElement: string | null } => {
  const effect = animation.effect as KeyframeEffect | null;
  if (!effect || !(effect.target instanceof Element)) {
    return { target: null, pseudoElement: null };
  }
  return { target: effect.target, pseudoElement: effect.pseudoElement ?? null };
};

// CamelCased keyframe keys that are not CSS properties.
const KEYFRAME_META_KEYS = new Set(["offset", "computedOffset", "easing", "composite"]);

const hyphenate = (property: string) =>
  property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export default function createAnimationQuarantine(scope: HTMLElement): () => void {
  const mountTime =
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : 0;

  const compensated: CompensatedPose[] = [];
  const snapshot: SnapshotEntry[] = [];

  const enumerable = typeof scope.getAnimations === "function";

  if (enumerable) {
    for (const animation of scope.getAnimations({ subtree: true })) {
      if (!isCssAnimation(animation)) continue;
      const name = animation.animationName!;
      // flemo's own compiled animations (the scope's screen motion, parts,
      // nested screens mid-flight) are the transition — never quarantined.
      if (name.startsWith(COMPILED_ANIMATION_PREFIX)) continue;
      const { target, pseudoElement } = animationTargets(animation);
      if (!target || target === scope) continue;
      if (target.closest("[data-flemo-part-name]") !== null) continue;

      snapshot.push({
        target,
        pseudoElement,
        animationName: name,
        paused: animation.playState === "paused"
      });

      // Pose pin: real elements only (pseudo-elements can't take inline
      // styles). The first keyframe is the animation's t≈0 pose; implicit
      // keyframes come back as computed values, so a from-less animation pins
      // to its base pose — a no-op by construction.
      if (pseudoElement !== null || !(target instanceof HTMLElement)) continue;
      const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
      const first = keyframes[0];
      if (!first || (first.offset ?? first.computedOffset ?? 0) !== 0) continue;
      const previous = new Map<string, string>();
      for (const [key, value] of Object.entries(first)) {
        if (KEYFRAME_META_KEYS.has(key)) continue;
        if (typeof value !== "string" && typeof value !== "number") continue;
        previous.set(key, target.style.getPropertyValue(hyphenate(key)));
        target.style.setProperty(hyphenate(key), String(value));
      }
      if (previous.size > 0) compensated.push({ element: target, previous });
    }
  }

  scope.setAttribute(QUARANTINE_ATTR, "true");

  return () => {
    scope.removeAttribute(QUARANTINE_ATTR);
    for (const { element, previous } of compensated) {
      for (const [key, value] of previous) {
        const property = hyphenate(key);
        if (value) element.style.setProperty(property, value);
        else element.style.removeProperty(property);
      }
    }
    if (!enumerable || snapshot.length === 0) return;

    // The attribute removal hasn't been through a style recalc yet;
    // getAnimations forces one synchronously, so the consumer animations
    // exist again in THIS commit and the rejoin lands before the next paint.
    const elapsed = Math.max(
      0,
      (typeof performance !== "undefined" ? performance.now() : mountTime) - mountTime
    );
    const respawned = scope.getAnimations({ subtree: true });
    for (const entry of snapshot) {
      if (!entry.target.isConnected || entry.paused) continue;
      const match = respawned.find((animation) => {
        if (!isCssAnimation(animation) || animation.animationName !== entry.animationName) {
          return false;
        }
        const { target, pseudoElement } = animationTargets(animation);
        return target === entry.target && pseudoElement === entry.pseudoElement;
      });
      if (!match) continue;
      try {
        match.currentTime = elapsed;
      } catch {
        // A detached or already-finished animation that rejects the seek
        // simply begins at the landing — the pre-compensation behavior.
      }
    }
  };
}

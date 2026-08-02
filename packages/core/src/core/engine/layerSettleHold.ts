import { collectAnimatedProperties } from "@transition/compileTransitionStyles";

import type { Transition } from "@transition/typing";

// Deferred compositor-layer demotion for the transition's rule-matched
// participants: the screen scope, its decorator, riding shared bars, and
// <Part> elements — every element whose compiled variant rule carries a
// `will-change`.
//
// The compiled variant rules scope `will-change` to the transitional statuses
// (PUSHING/POPPING/REPLACING) on purpose: promote right before the motion,
// drop the moment it ends. But on Blink the drop is not free — un-matching
// the rule at the COMPLETED flip demotes the element's compositor layer, and
// the demotion repaints the WHOLE element into its parent in that same commit
// (glass-verified with paint flashing: a full-viewport paint flash exactly at
// landing, on ordinary-weight content). That repaint lands on the exact
// frames the eye is watching settle — stacked onto the flip's other commits
// (the covered screen's freeze, the deferred content landing) it is the
// dominant main-thread item of the convergence tremor. The screen scope is
// the biggest layer but not the only one: the decorator (cupertino's dim
// overlay spans the full viewport), a riding shared bar, and every part run
// the same promote-on-status rules and demote in the same flip commit.
//
// So the engine pins each rule's promotion as an INLINE `will-change` for the
// length of the flight: inline styles survive the COMPLETED flip's rule
// un-match, so no demotion happens in that commit at all. The layer is
// released on its own clock, LAYER_SETTLE_MS after COMPLETED — past the
// convergence commits, inside the compositor warm-up's settle window (frame
// production is still forced there), and with the screen fully at rest,
// where a one-frame repaint presents nothing the eye can catch. A navigation
// starting back into the same element inside the window simply keeps the
// layer: the pending release is cancelled and the stamp refreshed, so a
// rapid push/pop pair never pays a demote-repromote round trip.
//
// The PUSHING/REPLACING rules additionally carry `contain: layout` (see
// compileTransitionStyles), and its removal at the flip is a style-driven
// relayout of the scope subtree landing in that same commit. The hold pins
// it inline alongside `will-change` and releases both together — the pinned
// `will-change` keeps the element a containing block for the whole window
// anyway, so extending the containment costs no additional semantics. The
// rules' `pointer-events: none` is deliberately NOT pinned: it must lift the
// instant the rule un-matches, or the landed screen would swallow taps for a
// third of a second.
//
// Trade-off, accepted knowingly: `will-change` keeps the element a
// containing block for fixed/absolute descendants while it is stamped. The
// compiled rules already impose that for the whole flight; this extends it
// by LAYER_SETTLE_MS past rest. A consumer opening a `position: fixed`
// overlay within ~a third of a second of landing would see it anchor to the
// screen box — which is the screen-sized viewport in every flemo layout — so
// the window is kept short rather than aligned with the warm-up's full span.
//
// The stamp mirrors the compiled rule's property list (the union across
// variants — a superset promotion is harmless; a missing one would demote a
// mid-flight layer), via the same collectAnimatedProperties the compiler and
// the swipe controller's bar promotion already use.

// Past the measured convergence storm (status flips, freeze, deferred
// landing — clustered within ~150ms of COMPLETED) and inside the compositor
// warm-up's 400ms settle window, so the demote repaint is produced on the
// forced frame cadence while nothing moves.
export const LAYER_SETTLE_MS = 300;

// Pending releases, keyed per element: a re-hold cancels its element's timer
// (the layer stays), and an unmounted element's entry is GC'd with it.
const pendingRelease = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

// Pin the compiled rule's promotion inline for the flight. Idempotent — the
// driver effect re-runs mid-flight (the anim-hold release) and re-stamps the
// same value. A definition that animates nothing leaves no stamp (the
// compiled rule has no `will-change` either — stamping would ADD a layer the
// CSS path never made). `containment` mirrors the rule's `contain: layout`
// (PUSHING/REPLACING only); a false re-hold strips a stale pin so a pop
// flight never inherits push's containment (pop's rules omit it — measured
// cost, see compileTransitionStyles).
export const holdScopeLayer = (
  scope: HTMLElement,
  transitionLike: Pick<Transition, "initial" | "variants">,
  containment = false
) => {
  const pending = pendingRelease.get(scope);
  if (pending !== undefined) {
    clearTimeout(pending);
    pendingRelease.delete(scope);
  }
  const properties = collectAnimatedProperties(transitionLike);
  if (properties.length === 0) return;
  scope.style.willChange = properties.join(", ");
  if (containment) scope.style.contain = "layout";
  else scope.style.removeProperty("contain");
};

// Release the pinned layer on its own clock, off the convergence commits. A
// scope that was never stamped (or already released) is a no-op, so calling
// this from every COMPLETED path is always safe.
export const releaseScopeLayerAfterSettle = (scope: HTMLElement) => {
  if (scope.style.willChange === "" && scope.style.contain === "") return;
  const pending = pendingRelease.get(scope);
  if (pending !== undefined) clearTimeout(pending);
  /* v8 ignore next 5 -- setTimeout exists in every runtime under test; the
     guard shields exotic embedders, where an immediate demotion is simply
     the pre-hold behavior. */
  if (typeof setTimeout !== "function") {
    scope.style.removeProperty("will-change");
    scope.style.removeProperty("contain");
    return;
  }
  pendingRelease.set(
    scope,
    setTimeout(() => {
      pendingRelease.delete(scope);
      scope.style.removeProperty("will-change");
      scope.style.removeProperty("contain");
    }, LAYER_SETTLE_MS)
  );
};

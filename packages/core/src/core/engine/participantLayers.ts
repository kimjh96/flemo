import { trackInlineWrite } from "@transition/animateInline";
import { variantHasAnimation } from "@transition/compileTransitionStyles";
import type resolveTransition from "@transition/resolveTransition";
import type { TransitionVariant } from "@transition/typing";
import { resolveVariantMotion, type VariantMotion } from "@transition/variantMotion";

import { collectScreenParts, collectVariantParts } from "@core/engine/flightParticipants";
import { governedEasingForMotion } from "@core/engine/landingGovernor";
import { holdScopeLayer, releaseScopeLayerAfterSettle } from "@core/engine/layerSettleHold";
import { BAR_RIDING_ATTR, PART_NAME_ATTR } from "@dom/attributes";
import { learnedFrameIntervalMs } from "@platform/displayCadence";
import { COMPILED_TIER_MAX_INTERVAL_MS } from "@platform/displayProbe";
import { detectBlinkEngine } from "@platform/engineProbes";
import { decoratorMap } from "@transition/decorator/decorator";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// COMPOSITOR LAYERS, held for the length of a flight and released after it.
//
// The compiled variant rules promote each participant with `will-change`, and
// that promotion UN-MATCHES at the COMPLETED flip — which would demote and
// repaint a layer on exactly the frames the eye is watching settle. So the
// engine pins the promotion inline for the flight and releases it off-cadence
// afterwards.
//
// The landing governor's inline easing rides along here: it is stamped on the
// same participants under the same lease, so a superseded stamp is released
// with the layer rather than left to bend the next variant's curve.

export const holdParticipantLayers = (
  elements: {
    scope: HTMLElement;
    decorator?: HTMLElement | null;
    bars?: (HTMLElement | null | undefined)[];
  },
  transition: ReturnType<typeof resolveTransition>,
  variant: TransitionVariant,
  owner: symbol
) => {
  const { scope, decorator, bars } = elements;
  const status = variant.split("-")[0];
  const containment = status === "PUSHING" || status === "REPLACING";
  // The landing governor for the COMPILED tier (see landingGovernor.ts): on
  // touch Blink at a genuine high-refresh cadence, the authored curve's
  // sub-pixel tail parks the sheet short of its landing and the COMPLETED flip
  // closes the gap late — the reshaped easing sprints the tail at one device
  // pixel per frame instead. Stamped as an INLINE longhand (clearInlineAnimation
  // strips it at COMPLETED with animation-delay); a riding bar shares the
  // screen's string so the pair stays in lockstep.
  //
  // Desktop removed (2026-08-18): the governor's 1-device-px tail sprint IS the
  // reported pop "드르륵" on 60Hz HiDPI desktops — the compiled tier runs the
  // AUTHORED easing untouched there, exactly like any well-made compositor
  // animation. Touch high-refresh keeps it (device-verified).
  const governEasing =
    detectBlinkEngine() &&
    typeof navigator !== "undefined" &&
    navigator.maxTouchPoints > 0 &&
    learnedFrameIntervalMs() < COMPILED_TIER_MAX_INTERVAL_MS;
  const dpr = governEasing && typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const easingFor = (motionSource: VariantMotion | null, box: HTMLElement): string | null => {
    if (!motionSource || !governEasing) return null;
    return governedEasingForMotion(motionSource, box, dpr, learnedFrameIntervalMs());
  };
  if (variantHasAnimation(transition, variant)) {
    holdScopeLayer(scope, transition, containment, owner);
    // Same shared gate as the span helper: variantHasAnimation has already
    // passed, so the motion resolves.
    const scopeMotion = resolveVariantMotion(transition, variant)!;
    const easing = easingFor(scopeMotion, scope);
    if (easing) {
      trackInlineWrite(scope, "animation-timing-function", owner);
      scope.style.animationTimingFunction = easing;
    }
    for (const bar of bars ?? []) {
      if (bar?.getAttribute(BAR_RIDING_ATTR) === "true") {
        holdScopeLayer(bar, transition, containment, owner);
        if (easing) {
          trackInlineWrite(bar, "animation-timing-function", owner);
          bar.style.animationTimingFunction = easing;
        }
      }
    }
  }
  if (decorator && transition.decoratorName) {
    const definition = decoratorMap.get(transition.decoratorName);
    if (definition && variantHasAnimation(definition, variant)) {
      holdScopeLayer(decorator, definition, containment, owner);
    }
  }
  for (const part of collectVariantParts(scope, variant)) {
    const definition = partTransitionMap.get(part.getAttribute(PART_NAME_ATTR)!);
    if (definition && variantHasAnimation(definition, variant)) {
      holdScopeLayer(part, definition, containment, owner);
      const partMotion = resolveVariantMotion(definition, variant)!;
      const partEasing = easingFor(partMotion, part);
      if (partEasing) {
        trackInlineWrite(part, "animation-timing-function", owner);
        part.style.animationTimingFunction = partEasing;
      }
    }
  }
};

// The COMPLETED counterpart: queue every participant's demotion off-cadence,
// LAYER_SETTLE_MS past the flip. Unstamped elements no-op, so this is safe
// to call unconditionally — including for swipe-promoted bars, whose inline
// `will-change` (createSwipeController's pre-promotion) previously dropped
// IN the flip commit and now rides the same deferred clock.
export const releaseParticipantLayers = (
  elements: {
    scope?: HTMLElement | null;
    decorator?: HTMLElement | null;
    bars?: (HTMLElement | null | undefined)[];
  },
  owner: symbol
) => {
  const { scope, decorator, bars } = elements;
  if (scope) {
    releaseScopeLayerAfterSettle(scope, owner);
    for (const part of collectScreenParts(scope)) releaseScopeLayerAfterSettle(part, owner);
  }
  if (decorator) releaseScopeLayerAfterSettle(decorator, owner);
  for (const bar of bars ?? []) {
    if (bar) releaseScopeLayerAfterSettle(bar, owner);
  }
};

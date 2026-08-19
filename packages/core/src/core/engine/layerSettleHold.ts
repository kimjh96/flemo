import { collectAnimatedProperties } from "@transition/compileTransitionStyles";

import type { Transition } from "@transition/typing";

import { residentScreenLayers } from "@core/engine/diagnosticFlags";
import { flightWindowActive, onFlightWindowIdle } from "@core/engine/flightWindow";

// Test seam re-export: the cached `flemo:layers` read lives in the flag
// registry, but the suites reach it through this module.
export { resetResidentLayersForTesting } from "@core/engine/diagnosticFlags";

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
// anyway, so extending the containment costs no additional semantics. Input
// gating is deliberately outside this hold: the moving destination remains
// hit-testable for native scrolling, while the React binding suppresses click
// activation only during PUSHING / REPLACING.
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

// OPT-IN diagnostic: keep SCREEN layers resident at rest instead of demoting
// them LAYER_SETTLE_MS past the flip. Measurement motive (2026-08, Mac
// Safari glass recordings): almost every flight shows exactly ONE skipped
// present in its first ~50-150ms, position-locked to the moment the flight's
// compositing layers are (re)created — WebKit pays a full-screen first
// raster into each fresh backing store. Demoting at rest means every next
// flight pays that creation raster again; keeping the screen layers
// resident should delete the onset skip, at the cost of resident backing
// stores. A URL visit arms it for the session (?flemo-layers=resident /
// ?flemo-layers=off), synced to the `flemo:layers` storage key eagerly at
// module load — the first drive runs after a navigation has already dropped
// the query; the (cached) read itself lives in diagnosticFlags.ts.
const syncResidentToggle = () => {
  try {
    if (typeof location === "undefined" || typeof sessionStorage === "undefined") return;
    if (/[?&]flemo-layers=resident\b/.test(location.search)) {
      sessionStorage.setItem("flemo:layers", "resident");
    } else if (/[?&]flemo-layers=off\b/.test(location.search)) {
      sessionStorage.removeItem("flemo:layers");
    }
  } catch {
    // Storage unavailable: the instrument simply stays off.
  }
};
syncResidentToggle();

// Per-element stamp record. `owners` maps each independent holder (an engine
// transition, a swipe gesture — both promote riding bars, and their holds can
// overlap; NESTED Routers each hold with their own instance token) to WHAT it
// requires: the property list it wants promoted and whether it wants
// containment. The applied `will-change` is the UNION of every owner's
// properties and the applied `contain` is the OR of their containment, so two
// owners wanting different things (transform vs filter) compose instead of
// clobbering. `willChange`/`contain` are the element's OWN inline values
// captured before the FIRST owner stamped, restored verbatim once the LAST
// owner releases — so a consumer's inline `will-change: filter` or
// `contain: paint` is never destroyed. The GC drops an unmounted element's
// record with it.
interface OwnerRequirement {
  properties: string[];
  containment: boolean;
}
interface LayerStamp {
  owners: Map<symbol, OwnerRequirement>;
  // The owner whose release scheduled the CURRENT pending demotion (null
  // while any owner still holds, or after a re-promotion voided the window).
  // Distinguishes THAT owner's animation-less re-hold — its own settle
  // window, its own stale pin, restore NOW — from everyone else's, which
  // must not touch the scheduled demotion. A single token, not an
  // accumulated set: a PAST owner from an earlier window (A held, released,
  // B re-held and released) has no rights over B's window — an accumulated
  // set would have let A cancel B's timer and demote early.
  settleOwner: symbol | null;
  willChange: string;
  contain: string;
  pending: ReturnType<typeof setTimeout> | null;
}
const stamps = new WeakMap<HTMLElement, LayerStamp>();

// The default owner for callers that don't distinguish holders (single-owner
// use). The engine and swipe controller pass their own PER-INSTANCE tokens so
// two nested Routers on one shared bar refcount independently.
const DEFAULT_OWNER = Symbol("flemo-layer-owner");

const restoreLayer = (scope: HTMLElement, stamp: LayerStamp) => {
  if (stamp.willChange) scope.style.willChange = stamp.willChange;
  else scope.style.removeProperty("will-change");
  if (stamp.contain) scope.style.contain = stamp.contain;
  else scope.style.removeProperty("contain");
};

// Compose the applied `contain` from the element's ORIGINAL value and the
// owners' layout requirement. The original's own semantics (a consumer's
// `contain: paint` clipping child overflow) must SURVIVE the flight, not be
// replaced for its span — so the original tokens stay and `layout` is added
// only when missing (`strict`/`content` already imply it).
const composeContain = (original: string, needsLayout: boolean): string => {
  const base = original.trim() === "none" ? "" : original.trim();
  if (!needsLayout) return base;
  if (!base) return "layout";
  if (/\b(layout|strict|content)\b/.test(base)) return base;
  return `${base} layout`;
};

// Apply the union of every current owner's requirements over the element's
// captured original values. The original inline `will-change` tokens ride
// along too (a consumer's `will-change: filter` keeps its promotion during a
// transform flight instead of losing it for the span).
const applyUnion = (scope: HTMLElement, stamp: LayerStamp) => {
  const properties = new Set<string>();
  let containment = false;
  for (const token of stamp.willChange.split(",")) {
    const trimmed = token.trim();
    if (trimmed && trimmed !== "auto") properties.add(trimmed);
  }
  for (const requirement of stamp.owners.values()) {
    for (const property of requirement.properties) properties.add(property);
    if (requirement.containment) containment = true;
  }
  // Every owner in the map has a non-empty property list (an animation-less
  // hold removes its entry), so the union is non-empty whenever owners exist.
  scope.style.willChange = [...properties].join(", ");
  const contain = composeContain(stamp.contain, containment);
  if (contain) scope.style.contain = contain;
  else scope.style.removeProperty("contain");
};

// Pin the compiled rule's promotion inline for the flight. Idempotent per
// owner — the driver effect re-runs mid-flight (the anim-hold release) and
// re-stamps the same requirement. A definition that animates nothing leaves
// no stamp (the compiled rule has no `will-change` either — stamping would
// ADD a layer the CSS path never made), and if THIS owner had previously
// stamped (a rehold into an animation-less variant) its requirement is
// dropped and the union recomputed — so its stale properties/containment
// never bleed into the animation-less flight. `containment` mirrors the
// rule's `contain: layout` (PUSHING/REPLACING only).
export const holdScopeLayer = (
  scope: HTMLElement,
  transitionLike: Pick<Transition, "initial" | "variants">,
  containment = false,
  owner: symbol = DEFAULT_OWNER
) => {
  const properties = collectAnimatedProperties(transitionLike);
  let stamp = stamps.get(scope);
  if (properties.length === 0) {
    // Nothing to promote for this owner. Only an owner with a CURRENT stake
    // or a FORMER one (its own settle window — a push landing into an
    // animation-less pop must not carry push's stale containment) may mutate
    // the stamp here. A STRANGER's animation-less hold is a strict no-op: a
    // pending settle timer exists exactly when the owners map is empty, and
    // letting a stranger reach in would cancel another owner's scheduled
    // demotion and demote the layer immediately — on the very convergence
    // frames the deferral protects.
    if (!stamp) return;
    if (stamp.owners.has(owner)) {
      stamp.owners.delete(owner);
      if (stamp.owners.size === 0) {
        if (stamp.pending != null) clearTimeout(stamp.pending);
        restoreLayer(scope, stamp);
        stamps.delete(scope);
      } else {
        applyUnion(scope, stamp); // recompute without this owner's stake
      }
    } else if (owner === stamp.settleOwner && stamp.owners.size === 0) {
      if (stamp.pending != null) clearTimeout(stamp.pending);
      restoreLayer(scope, stamp);
      stamps.delete(scope);
    }
    return;
  }
  // A real promotion legitimately cancels a pending demotion from ANY owner:
  // the element is becoming a layer again, so the demote-repromote round
  // trip the settle window exists to avoid would be pure waste.
  if (stamp?.pending != null) {
    clearTimeout(stamp.pending);
    stamp.pending = null;
  }
  if (!stamp) {
    stamp = {
      owners: new Map(),
      settleOwner: null,
      willChange: scope.style.willChange,
      contain: scope.style.contain,
      pending: null
    };
    stamps.set(scope, stamp);
  }
  stamp.owners.set(owner, { properties, containment });
  stamp.settleOwner = null; // a re-promotion voids the previous settle window
  applyUnion(scope, stamp);
};

// Release this owner's hold. When OTHER owners remain, the union recomputes
// without this owner (the element stays a layer via the survivors, so no
// demote-repaint) and the layer lives on. When it was the LAST owner, the
// element is demoted on its own clock — LAYER_SETTLE_MS after release, off
// the convergence commits — and restored to its captured original values. A
// scope this owner never stamped is a no-op, so calling this from every
// COMPLETED path is always safe.
export const releaseScopeLayerAfterSettle = (scope: HTMLElement, owner: symbol = DEFAULT_OWNER) => {
  const stamp = stamps.get(scope);
  if (!stamp || !stamp.owners.has(owner)) return;
  stamp.owners.delete(owner);
  if (stamp.owners.size > 0) {
    applyUnion(scope, stamp); // survivors keep the element a layer
    return;
  }
  // EXPERIMENT branch (diagnostic, default off): screens stay promoted at
  // rest — no demotion, no re-creation raster on the next flight. Bars and
  // other non-screen participants demote normally. `contain` still restores
  // (a resident containment would change rest-layout semantics).
  if (
    residentScreenLayers() &&
    typeof scope.closest === "function" &&
    scope.closest("[data-flemo-screen]")
  ) {
    if (stamp.pending != null) clearTimeout(stamp.pending);
    stamp.pending = null;
    stamp.settleOwner = null;
    scope.style.willChange = "transform";
    if (stamp.contain) scope.style.contain = stamp.contain;
    else scope.style.removeProperty("contain");
    return;
  }
  stamp.settleOwner = owner; // this owner's window: it alone may cut it short
  if (stamp.pending != null) clearTimeout(stamp.pending);
  /* v8 ignore next 5 -- setTimeout exists in every runtime under test; the
     guard shields exotic embedders, where an immediate demotion is simply
     the pre-hold behavior. */
  if (typeof setTimeout !== "function") {
    restoreLayer(scope, stamp);
    stamps.delete(scope);
    return;
  }
  scheduleDemotion(scope, stamp);
};

// The demotion clock, gated on the flight window. A quick pop chained onto a
// push's landing overlaps the push's LAYER_SETTLE window — and the elements
// the pop does NOT re-hold (the push's dim decorator, its parts, a deep
// screen) would demote MID-FLIGHT: device-measured (iPhone, 2026-08) as the
// intermittent ~30ms rAF gap + stutter step on the pop-returning parallax,
// position-locked to landing+300ms. So when the timer fires into an active
// flight, the demotion re-queues for the flight's rest and runs the settle
// clock again from there — the repaint only ever lands where it was designed
// to: with the glass at rest. Re-holds still cancel through `stamp.pending`;
// the idle callback re-checks the stamp's state so a voided window (re-hold,
// unmount, a newer owner) never demotes.
const scheduleDemotion = (scope: HTMLElement, stamp: LayerStamp) => {
  stamp.pending = setTimeout(() => {
    stamp.pending = null;
    if (flightWindowActive()) {
      onFlightWindowIdle(() => {
        if (
          stamps.get(scope) === stamp &&
          stamp.owners.size === 0 &&
          stamp.settleOwner !== null &&
          stamp.pending === null
        ) {
          scheduleDemotion(scope, stamp);
        }
      });
      return;
    }
    restoreLayer(scope, stamp);
    stamps.delete(scope);
  }, LAYER_SETTLE_MS);
};

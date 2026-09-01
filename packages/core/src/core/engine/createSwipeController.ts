import animateInline, { clearInlineAnimation } from "@transition/animateInline";

import { easeControlPoints } from "@transition/cubicBezier";
import { resolveRideTarget } from "@transition/rideOffset";
import { reaimReleaseEase, releaseLaunchSlope, swipeSettleSeconds } from "@transition/swipeSettle";

import type { Transition, TransitionVariant } from "@transition/typing";
import { resolveVariantMotion } from "@transition/variantMotion";

import findScrollable from "@utils/findScrollable";

import { stageBarParts, type StagedBarParts } from "@core/engine/barPartStaging";
import { collectLayerRiders } from "@core/engine/layerRiders";
import { holdScopeLayer, releaseScopeLayerAfterSettle } from "@core/engine/layerSettleHold";
import { beginRiderSwipe, type RiderMotion, type RiderSwipe } from "@core/engine/riderSwipe";
import {
  attrSelector,
  attrValueSelector,
  BAR_ATTR,
  BAR_ID_ATTR,
  BAR_ID_TYPE_ATTR,
  DECORATOR_ATTR,
  PART_HOME_ATTR,
  PART_NAME_ATTR,
  SCREEN_ATTR,
  SKIP_ANIMATION_ATTR
} from "@dom/attributes";

import { sharedBarsMatch, type SharedBarPresenceLike } from "@screen/computeBarRiding";

import { resolveDecoratorClock } from "@transition/decorator/resolveDecoratorClock";
import {
  partTransitionMap,
  resolvePartDefinition
} from "@transition/partTransition/partTransition";

import type { SharedBarId, SharedBarsMetadata } from "@screen/store";

import type { Decorator } from "@transition/decorator/typing";

// A release ceiling borrowed from another participant: the span to scale
// against, and the curve to read the remaining distance off. Only the DECORATOR
// takes one, and it takes the screens'.
type CeilingOverride = {
  seconds: number;
  ease: readonly [number, number, number, number] | null;
};

// Presence of a partner screen's shared bars — owned by the pure decision
// module (computeBarRiding); re-exported here for the controller's config
// surface and the public barrel.
export type { SharedBarPresenceLike } from "@screen/computeBarRiding";

export interface SwipeControllerElements {
  scope: HTMLElement | null;
  // The screen container (parent of the scope) used to DOM-walk to the prev
  // screen's subtree at swipe start.
  screenContainer: HTMLElement | null;
  decorator: HTMLElement | null;
  sharedTopBar: HTMLElement | null;
  sharedBottomBar: HTMLElement | null;
}

// Everything the controller needs from its host, read live so it reflects the
// binding's current render. No framework types — any binding can supply these.
export interface SwipeControllerConfig {
  getTransition: () => Transition;
  getDecorator: () => Decorator | undefined;
  getElements: () => SwipeControllerElements;
  hasSharedTopBar: () => boolean;
  hasSharedBottomBar: () => boolean;
  getSharedTopBarId?: () => SharedBarId | undefined;
  getSharedBottomBarId?: () => SharedBarId | undefined;
  getViewportScrollHeight: () => number;
  // The full readiness gate for starting a drag (isRoot / isActive / status /
  // dragStatus / swipeDirection / keyboard), computed by the binding.
  isReadyForDrag: () => boolean;
  // The partner screen's shared-bar presence (active screen looks one below,
  // an entering screen looks at the current top).
  getPartnerBars: () => SharedBarPresenceLike | undefined;
  getPartnerBarMetadata?: () => SharedBarsMetadata | undefined;
  setDragStatus: (status: "IDLE" | "PENDING") => void;
  // Commit a swipe-back navigation (window.history.back in the browser binding).
  back: () => void;
  // THE GESTURE, offered to whatever else the binding drives with it.
  //
  // A shared element cannot be driven from a transition's `onSwipe` the way a
  // screen or a <Part> is: it is not the author's element to write, it belongs
  // to a flight the runtime stages. So the controller reports the gesture
  // instead — start, progress, release — and the binding hands it to the morph
  // runtime. Every transition with a `swipeDirection` gets an interactive morph
  // out of this without authoring anything, cupertino included.
  onDragStart?: () => void;
  /** 0 at rest, 1 at the point the gesture would commit. */
  onDragProgress?: (progress: number) => void;
  /** The release: whether it committed, and the seconds the screens settle in. */
  onDragSettle?: (committed: boolean, seconds: number) => void;
  /**
   * The Router scope's part layer (see @screen/partLayer), for staging the
   * covered side's matched shared-bar parts while the finger is down.
   *
   * A drag is not a flight: the navigate status stays COMPLETED throughout, so
   * the engine's own staging never arms and the previous screen's bar parts
   * cross-fade under the screen being dragged off them. Omitted by a binding
   * that renders no layer; the drag then behaves as it did before.
   */
  getPartLayer?: () => HTMLElement | null;
}

export interface SwipeController {
  pointerDown: (event: PointerEvent) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: (event: PointerEvent) => void;
  pointerCancel: (event: PointerEvent) => void;
  // Pointer capture was released without the gesture ending — the element was
  // removed or hidden under it. Forwarded by the binding as `lostpointercapture`.
  lostPointerCapture: (event: PointerEvent) => void;
  /**
   * Abandon whatever gesture is in flight, with no pointer to close it.
   *
   * The binding calls this when the SCREEN goes away underneath one: an unmount,
   * or a freeze (which detaches the listeners but keeps this controller, since
   * it outlives the effects). Without it the gesture state has exactly one way
   * out — a pointerup carrying the id that armed it — and if the browser never
   * delivers that event, nothing ever does. See the note on `abandon` below.
   */
  abandon: () => void;
  // Whether an in-progress drag wants touchmove default suppressed.
  shouldPreventTouch: () => boolean;
}

// Framework-neutral swipe-back gesture controller. Holds the gesture state that
// used to live as refs in ScreenMotion; the binding forwards native pointer
// events and supplies the live environment, so every binding shares the same
// intent arbitration, cancellation, and settle behavior.
export default function createSwipeController(config: SwipeControllerConfig): SwipeController {
  // This controller's per-instance layer-hold owner token, distinct from the
  // engine's and from any other controller's. A riding bar can be promoted by
  // both a swipe gesture and an engine transition at once; the settle hold
  // refcounts each owner so the bar is demoted only after ALL release (see
  // layerSettleHold.ts).
  const layerOwner = Symbol("flemo-swipe-layer");

  let prevScreen: HTMLElement | null = null;
  let prevDecorator: HTMLElement | null = null;
  // The previous screen's own container, kept because the drag stages that
  // screen's bar parts and the confirm site is not where it was resolved.
  let prevContainer: HTMLElement | null = null;
  // Its matched-bar parts while they are up in the part layer.
  let stagedDragParts: StagedBarParts | null = null;
  // The riders this gesture moves itself, for the authors who wrote no hooks.
  let riderSwipe: RiderSwipe | null = null;
  let ridingBars: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };
  // The subset of the ride lists that is a SHARED BAR, and the screen box those
  // bars must travel. A bar's own box is shorter than its screen's, so a drag
  // handler that writes `y: "100%"` sends the bar its own height and the screen
  // a whole viewport (see rideOffset.ts). <Layer> riders are deliberately NOT in
  // this set: a slot's box is the OUTERMOST screen's, which is the basis its
  // percentage is already written against.
  let ridingBarSet: Set<HTMLElement> = new Set();
  let rideScreenHeight = 0;
  // <Part> elements on the current + previous screens, driven inline by
  // the drag progress (the interactive path; the programmatic path is CSS).
  let partEls: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };

  let shouldStartDrag = false;
  let isTouchPrevented = false;
  let swipeActive = false;

  // NOTHING ELSE DEFENDS A DRAG FROM THE BROWSER'S OWN GESTURES.
  //
  // Touch is covered — the binding preventDefaults `touchmove`. A MOUSE drag
  // had nothing: dragging left-to-right across a screen's text starts a native
  // selection (or an image drag), the browser takes the pointer away with
  // `pointercancel`, and the swipe force-cancels. Measured off a screen
  // recording: the selection highlight is on screen in the same frames the
  // dragged screen turns around and settles home from 43% of its travel, well
  // past the commit threshold. From the user's side the gesture simply does not
  // work, at random.
  //
  // So the two events are suppressed for exactly as long as a gesture holds the
  // pointer, and never otherwise: selecting text on a resting screen is the
  // consumer's business and stays untouched. This suppresses the BROWSER's
  // default action; it writes nothing to consumer content and leaves no style
  // behind.
  // No `armed` flag guards these: the listener is one stable reference, so
  // `addEventListener` refuses the duplicate itself and `removeEventListener`
  // is a no-op for a listener that was never added. A flag would only be a
  // second, less reliable copy of what the DOM already tracks.
  const suppressNativeDrag = (event: Event) => event.preventDefault();
  const holdNativeDrag = () => {
    document.addEventListener("selectstart", suppressNativeDrag);
    document.addEventListener("dragstart", suppressNativeDrag);
  };
  const releaseNativeDrag = () => {
    document.removeEventListener("selectstart", suppressNativeDrag);
    document.removeEventListener("dragstart", suppressNativeDrag);
  };

  let activePointerId: number | null = null;
  let swipeStartPromise: Promise<void> | null = null;
  let forceCancelRequested = false;

  let swipeStartPoint = { x: 0, y: 0 };
  let swipeLastPoint = { x: 0, y: 0 };
  let swipeLastTime = 0;
  let swipeVelocity = { x: 0, y: 0 };
  /** Recent pointer positions, for the release velocity. See below. */
  let velocityTrail: { t: number; x: number; y: number }[] = [];

  let scrollableX: { element: HTMLElement | null; hasMarker: boolean } = {
    element: null,
    hasMarker: false
  };
  let scrollableY: { element: HTMLElement | null; hasMarker: boolean } = {
    element: null,
    hasMarker: false
  };
  let startX = 0;
  let startY = 0;

  const buildSwipeInfo = (event: PointerEvent) => ({
    point: { x: event.clientX, y: event.clientY },
    offset: {
      x: event.clientX - swipeStartPoint.x,
      y: event.clientY - swipeStartPoint.y
    },
    delta: { x: event.clientX - swipeLastPoint.x, y: event.clientY - swipeLastPoint.y },
    velocity: swipeVelocity
  });

  // TAP-SLOP: a click/tap that merely grazes the swipe edge (1-5px of pointer
  // jitter) engages the grab like any drag — and its release then played the
  // full 300ms cancel settle on BOTH screens. When that same tap was a
  // navigation trigger (the back button lives in the edge zone), the settle's
  // WAAPI fought the navigation's driver for the whole 300ms — device-captured
  // (2026-08-12, Chrome touch emulation): pop starts, glides BACKWARD to the
  // pre-pop pose under the settle, then teleports to the driver's true
  // position the instant the settle ends. Sub-slop gestures are TAPS: their
  // cancel restores instantly (duration 0) and no settle animation is born.
  const SWIPE_TAP_SLOP_PX = 6;
  // Do not arbitrate on sensor noise. Android commonly reports a small
  // positive X component at the start of a fast vertical fling; claiming on
  // that first pixel turns a scroll into swipe-back. Eight CSS pixels matches
  // the platform-scale touch slop while keeping a deliberate drag responsive.
  const SWIPE_INTENT_SLOP_PX = 8;
  // Page-wide recognition needs a narrow directional cone: unlike an edge-
  // only gesture, every ordinary vertical fling is a candidate. Requiring a
  // 3:1 primary-axis lead (about an 18.4° cone from the intended axis)
  // preserves intentional diagonal tolerance over the old fixed 2px rule
  // without letting scroll flings alias as back swipes.
  const SWIPE_AXIS_DOMINANCE_RATIO = 3;
  let swipeMaxDragPx = 0;

  const releasePointerCapture = (event: PointerEvent) => {
    const { scope } = config.getElements();
    if (scope?.hasPointerCapture(event.pointerId)) {
      scope.releasePointerCapture(event.pointerId);
    }
  };

  // HOW FAST THE FINGER WAS GOING, over a WINDOW rather than a single pair.
  //
  // This used to be the last two pointermoves: `(x - lastX) / (t - lastT)`. One
  // sample, and the release reads it as the gesture's speed — so a single
  // unlucky pair decides the whole landing. Browsers do not deliver pointermove
  // on an even clock: they coalesce, they batch behind a busy frame, and a pair
  // that happens to span 6ms with 12px between them reports 2000 px/s for a
  // finger that was moving at 500.
  //
  // What that costs is not subtle, because the release length divides BY this
  // number. With 30% of the screen left, an honest 600 px/s asks for 0.21s; a
  // spurious 2000 px/s collapses it onto the 0.12s floor — the same landing in
  // little more than half the time, which is exactly what "too whippy" is.
  // Device-reported on Safari, against Android on the same gesture.
  //
  // A window over the last VELOCITY_WINDOW_MS averages the jitter out while
  // still following a real flick: it is the finger's recent trend, which is
  // what a release continues. `delta` and the follow keep using the LAST pair —
  // those track the finger, and must not be smoothed.
  const VELOCITY_WINDOW_MS = 80;

  const updateSwipeVelocity = (event: PointerEvent) => {
    const now = event.timeStamp;
    velocityTrail.push({ t: now, x: event.clientX, y: event.clientY });
    // Keep at least two samples, so a gesture shorter than the window still has
    // a measurement to give.
    while (velocityTrail.length > 2 && now - velocityTrail[0]!.t > VELOCITY_WINDOW_MS) {
      velocityTrail.shift();
    }
    const oldest = velocityTrail[0]!;
    const dt = Math.max(1, now - oldest.t);
    swipeVelocity = {
      x: ((event.clientX - oldest.x) / dt) * 1000,
      y: ((event.clientY - oldest.y) / dt) * 1000
    };
    swipeLastPoint = { x: event.clientX, y: event.clientY };
    swipeLastTime = now;
    swipeMaxDragPx = Math.max(
      swipeMaxDragPx,
      Math.abs(event.clientX - swipeStartPoint.x),
      Math.abs(event.clientY - swipeStartPoint.y)
    );
  };

  // Mirror every write to a screen onto the bars that ride along with it, in
  // the SAME synchronous tick (see ScreenMotion history for why a rAF mirror
  // trailed by a frame). Two ride lists because cupertino / material animate
  // both the current and the previous screen per tick.
  const animateSwipe: typeof animateInline = (target, value, options) => {
    const result = animateInline(target, value, options, layerOwner);
    // A shared bar takes the same values with its percentage y resolved against
    // the screen box; every other rider takes them verbatim.
    const mirror = (bar: HTMLElement) =>
      animateInline(
        bar,
        ridingBarSet.has(bar) ? resolveRideTarget(value, rideScreenHeight) : value,
        options,
        layerOwner
      );
    if (target === config.getElements().scope) {
      for (const bar of ridingBars.current) mirror(bar);
    } else if (target === prevScreen) {
      for (const bar of ridingBars.prev) mirror(bar);
    }
    return result;
  };

  // A screen container's OWN chrome, by direct child only. The binding renders
  // the scope, the shared bars and the decorator as direct children of the
  // container, so this is exactly that screen's set — while a descendant query
  // is not: a screen hosting a NESTED <Router> has that router's screens INSIDE
  // its scope, and their decorator and bars are deeper but EARLIER in document
  // order, so `querySelector` returns the NESTED screen's element. Device-
  // reported on plen's 내 지역 tab (the one page with a nested Router): a
  // swipe-back faded the inner router's dim while the screen's own dim stayed
  // at full opacity for the whole drag.
  const ownChild = (container: HTMLElement | null, selector: string): HTMLElement | null => {
    if (!container) return null;
    for (const child of Array.from(container.children)) {
      const element = child as HTMLElement;
      if (typeof element.matches === "function" && element.matches(selector)) return element;
    }
    return null;
  };

  const captureRidingBars = (prevScreenContainer: HTMLElement | null, scope: HTMLElement) => {
    const partnerBars = config.getPartnerBars();
    const partnerMetadata = config.getPartnerBarMetadata?.();
    // A previous screen can have committed its DOM before its Activity-
    // reconnected layout effects republish the registry. Use that DOM as the
    // synchronous fallback so the first swipe tick keeps legacy behavior.
    const prevTopBar = ownChild(prevScreenContainer, attrValueSelector(BAR_ATTR, "app"));
    const prevNavBar = ownChild(prevScreenContainer, attrValueSelector(BAR_ATTR, "nav"));
    const domMetadata = (bar: HTMLElement | null | undefined) => {
      if (!bar) return undefined;
      const value = bar.getAttribute(BAR_ID_ATTR);
      if (value === null) return {};
      return {
        id: bar.getAttribute(BAR_ID_TYPE_ATTR) === "number" ? Number(value) : value
      };
    };
    const currentTop = config.hasSharedTopBar() ? { id: config.getSharedTopBarId?.() } : undefined;
    const currentBottom = config.hasSharedBottomBar()
      ? { id: config.getSharedBottomBarId?.() }
      : undefined;
    const partnerTop =
      partnerMetadata?.topBar ?? (partnerBars?.topBar ? {} : domMetadata(prevTopBar));
    const partnerBottom =
      partnerMetadata?.bottomBar ?? (partnerBars?.bottomBar ? {} : domMetadata(prevNavBar));

    // Current side: this screen's own bars ride if the partner lacks a match.
    const current: HTMLElement[] = [];
    const { sharedTopBar, sharedBottomBar } = config.getElements();
    if (sharedTopBar && currentTop && !sharedBarsMatch(currentTop, partnerTop))
      current.push(sharedTopBar);
    if (sharedBottomBar && currentBottom && !sharedBarsMatch(currentBottom, partnerBottom)) {
      current.push(sharedBottomBar);
    }

    // Prev side: the partner screen's bars (in its own subtree) ride if this
    // screen lacks a match. Queried directly so we don't reach into the
    // partner instance.
    const prev: HTMLElement[] = [];
    if (prevScreenContainer) {
      if (prevTopBar && partnerTop && !sharedBarsMatch(partnerTop, currentTop))
        prev.push(prevTopBar);
      if (prevNavBar && partnerBottom && !sharedBarsMatch(partnerBottom, currentBottom)) {
        prev.push(prevNavBar);
      }
    }

    // <Layer> overlays ride too, and they are the one rider that is NOT in the
    // container being walked. A drag does not go through the compiled rules —
    // it writes inline styles frame by frame — so an overlay left out of these
    // lists stands perfectly still while the screen it belongs to slides under
    // it. Measured before this existed: mid-drag the screen reached -65 and the
    // sheet held at 0.
    // Recorded before the layer riders join the lists, so the set holds bars
    // only. The screen box is read once per gesture, here, rather than per
    // move: it cannot change while a finger is down, and the drag path exists
    // to avoid exactly this kind of read on a moving frame.
    ridingBarSet = new Set([...current, ...prev]);
    rideScreenHeight = scope.getBoundingClientRect().height;

    current.push(...collectLayerRiders(config.getElements().screenContainer));
    prev.push(...collectLayerRiders(prevScreenContainer));

    ridingBars = { current, prev };

    // Pre-promote the riding bars so the first inline write doesn't pay layer
    // creation. Routed through the settle hold (not a bare style write) so a
    // swipe starting inside a previous release's settle window cancels the
    // pending demotion — otherwise that timer would strip `will-change`
    // mid-drag.
    for (const bar of current) holdScopeLayer(bar, config.getTransition(), false, layerOwner);
    for (const bar of prev) holdScopeLayer(bar, config.getTransition(), false, layerOwner);
  };

  // The screens and the dim the drag itself moves. A FLIGHT promotes every
  // participant for its whole span (holdParticipantLayers → layerSettleHold),
  // which is why a transition stays smooth on a weak GPU; the gesture promoted
  // its riding BARS only, so the two full-screen scopes and the dim were
  // repainted from scratch on every frame the finger moved. Same helper, same
  // owner, same deferred demotion — a re-grab inside the previous settle window
  // cancels that pending demotion instead of stripping `will-change` mid-drag.
  const holdDragLayers = () => {
    const { scope, decorator } = config.getElements();
    const transition = config.getTransition();
    if (scope) holdScopeLayer(scope, transition, false, layerOwner);
    if (prevScreen) holdScopeLayer(prevScreen, transition, false, layerOwner);
    const decoratorDef = config.getDecorator();
    if (decoratorDef) {
      // The decorator's variant table only carries a clock once this
      // transition's is folded in (resolveDecoratorClock); the layer hold reads
      // that table to size what it promotes.
      const decoratorClock = resolveDecoratorClock(transition, decoratorDef);
      if (decorator) holdScopeLayer(decorator, decoratorClock, false, layerOwner);
      if (prevDecorator) holdScopeLayer(prevDecorator, decoratorClock, false, layerOwner);
    }
  };

  const releaseDragLayers = () => {
    const { scope, decorator } = config.getElements();
    if (scope) releaseScopeLayerAfterSettle(scope, layerOwner);
    if (prevScreen) releaseScopeLayerAfterSettle(prevScreen, layerOwner);
    if (decorator) releaseScopeLayerAfterSettle(decorator, layerOwner);
    if (prevDecorator) releaseScopeLayerAfterSettle(prevDecorator, layerOwner);
  };

  const releaseRidingBars = () => {
    // A cancelled swipe has just animated back to rest — dropping the bars'
    // promotion in this commit would repaint them on the exact settle frames
    // (see layerSettleHold.ts), so the demotion rides the deferred clock.
    for (const bar of ridingBars.current) {
      clearInlineAnimation(bar, undefined, layerOwner);
      releaseScopeLayerAfterSettle(bar, layerOwner);
    }
    for (const bar of ridingBars.prev) {
      clearInlineAnimation(bar, undefined, layerOwner);
      releaseScopeLayerAfterSettle(bar, layerOwner);
    }
    ridingBars = { current: [], prev: [] };
  };

  // How long a staging may sit unclaimed. Every drag exit releases explicitly,
  // so this only covers a teardown that reaches none of them — and unlike a
  // flight, a drag has no authored span to derive a deadline from: it lasts as
  // long as the finger does.
  const DRAG_STRANDED_MS = 60_000;

  // Lift the covered side's matched-bar parts for the drag. The screen being
  // dragged off is the one on top, so the previous screen's bar — the one whose
  // parts are supposed to trade places with it — is underneath the whole way.
  const stageDragParts = () => {
    if (stagedDragParts || !prevScreen || !prevContainer) return;
    stagedDragParts = stageBarParts({
      scope: prevScreen,
      bars: [
        ownChild(prevContainer, attrValueSelector(BAR_ATTR, "app")),
        ownChild(prevContainer, attrValueSelector(BAR_ATTR, "nav"))
      ],
      layer: config.getPartLayer?.() ?? null,
      strandedMs: DRAG_STRANDED_MS
    });
  };

  const releaseDragParts = () => {
    stagedDragParts?.release();
    stagedDragParts = null;
  };

  // Lift and arm the covered side's riders, once the screen they belong to can
  // actually be measured. Safe to call on every frame of a drag: the staging
  // returns null while that screen is still Activity-hidden, and both halves
  // no-op once they have taken.
  const armDragRiders = () => {
    // The finger may already be gone; a drag that ended owns nothing.
    if (!swipeActive || stagedDragParts) return;
    // The drag is a flight the engine never sees: the navigate status stays
    // COMPLETED, so nothing else stages the covered side's bar parts and they
    // would cross-fade underneath the screen the finger is moving.
    stageDragParts();
    if (!stagedDragParts) return;
    // Nor does anything else MOVE them. The compiled rules key on a status no
    // drag ever sets, so a part or a dim that declared only a pose sat still
    // while the screens followed the finger.
    riderSwipe = beginRiderSwipe(collectRiders());
  };

  // The riders this gesture drives ITSELF: the ones that declared a pose and no
  // swipe hooks. An author who wrote `onSwipe*` owns that element and is called
  // through drivePartTransitions as before; this is the default for everyone
  // else, who until now got nothing while the screens moved under their chrome.
  //
  // A swipe-back is a POP, so the dragged screen's riders take the active side
  // of POPPING and the screen returning underneath takes the passive one — the
  // same two variants the landing flight would run.
  const collectRiders = (): RiderMotion[] => {
    const transition = config.getTransition();
    const riders: RiderMotion[] = [];

    const addPart = (element: HTMLElement, active: boolean) => {
      const authored = partTransitionMap.get(element.getAttribute(PART_NAME_ATTR)!);
      if (!authored || authored.onSwipe || authored.onSwipeStart || authored.onSwipeEnd) return;
      const definition = resolvePartDefinition(element.getAttribute(PART_NAME_ATTR), transition);
      const motion = definition
        ? resolveVariantMotion(definition, `POPPING-${active}` as TransitionVariant)
        : null;
      if (motion) riders.push({ element, motion });
    };
    for (const element of partEls.current) addPart(element, true);
    for (const element of partEls.prev) addPart(element, false);

    const decoratorDef = config.getDecorator();
    if (decoratorDef && !decoratorDef.onSwipe && !decoratorDef.onSwipeStart) {
      const clock = resolveDecoratorClock(transition, decoratorDef);
      const addDecorator = (element: HTMLElement | null, active: boolean) => {
        if (!element) return;
        const motion = resolveVariantMotion(clock, `POPPING-${active}` as TransitionVariant);
        if (motion) riders.push({ element, motion });
      };
      addDecorator(config.getElements().decorator ?? null, true);
      addDecorator(prevDecorator, false);
    }

    return riders;
  };

  const capturePartTransitions = (prevScreenContainer: HTMLElement | null) => {
    const { screenContainer } = config.getElements();
    // Reached only after beginSwipe's guards resolve the scope + prev screen, so
    // both containers are present.
    // Parts legitimately sit anywhere inside the screen — in its content, or
    // in a shared bar beside the scope — so this stays a descendant query. What
    // it must not collect is a NESTED Router's parts: those belong to a screen
    // this swipe is not moving. A part's owning screen is its closest scope
    // (null for a bar-mounted one, which this screen still owns).
    const select = (root: HTMLElement | null) => {
      const ownScope = ownChild(root, attrSelector(SCREEN_ATTR));
      const inPlace = Array.from(
        root!.querySelectorAll<HTMLElement>(attrSelector(PART_NAME_ATTR))
      ).filter((part) => {
        const owner = part.closest(attrSelector(SCREEN_ATTR));
        return owner === null || owner === ownScope;
      });
      // Plus any this screen has STAGED. A drag lifts the covered side's
      // bar parts out of the container this walks, and a part the gesture
      // cannot see is a part the gesture cannot move — it would hang at its
      // pre-drag pose while everything else follows the finger.
      const screenId = ownScope?.getAttribute(SCREEN_ATTR) ?? null;
      if (screenId === null) return inPlace;
      const staged = Array.from(
        root!.ownerDocument.querySelectorAll<HTMLElement>(
          attrValueSelector(PART_HOME_ATTR, screenId)
        )
      );
      return staged.length === 0 ? inPlace : [...inPlace, ...staged];
    };
    partEls = { current: select(screenContainer), prev: select(prevScreenContainer) };
  };

  // Drive each captured <Part> element through its registered
  // part-transition's swipe hook, passing whether it sits on the current
  // (active) or previous screen so the author can map the drag per side.
  const drivePartTransitions = (
    hook: "start" | "swipe" | "end",
    triggered: boolean,
    progress: number,
    // The release passes its gesture-scaled writer so a part lands with the
    // screens (see endSwipe); the drag phase writes instantly as before.
    animateOverride?: typeof animateInline
  ) => {
    const run = (element: HTMLElement, active: boolean) => {
      // Selected by PART_NAME_ATTR, so the attribute is present.
      const def = partTransitionMap.get(element.getAttribute(PART_NAME_ATTR)!);
      if (!def) return;
      // The part hook's writes must carry THIS controller's writer token —
      // releasePartTransitions clears under it, and an unstaked write would
      // never match that owner-scoped clear (leaking the inline values and
      // their leases past a cancelled swipe).
      const animate: typeof animateInline =
        animateOverride ??
        ((target, value, animOptions) => animateInline(target, value, animOptions, layerOwner));
      const options = { animate, element, active };
      if (hook === "swipe") def.onSwipe?.(triggered, progress, options);
      else if (hook === "start") def.onSwipeStart?.(triggered, options);
      else def.onSwipeEnd?.(triggered, options);
    };
    for (const element of partEls.current) run(element, true);
    for (const element of partEls.prev) run(element, false);
  };

  const releasePartTransitions = () => {
    for (const element of [...partEls.current, ...partEls.prev])
      clearInlineAnimation(element, undefined, layerOwner);
    partEls = { current: [], prev: [] };
  };

  const beginSwipe = async (event: PointerEvent) => {
    const transition = config.getTransition();
    if (!transition.swipeDirection || config.getViewportScrollHeight() > 10) {
      isTouchPrevented = false;
      return;
    }

    const { scope, screenContainer, decorator } = config.getElements();
    if (!scope) {
      isTouchPrevented = false;
      return;
    }

    // Screen containers render as direct siblings: the <Activity>-based freeze
    // adds no wrapper element, so the previous screen sits in the immediately
    // preceding sibling container. (It used to sit one level up, under a freeze
    // wrapper div that no longer exists.)
    const prevScreenContainer =
      (screenContainer?.previousElementSibling as HTMLElement | null) ?? null;
    prevContainer = prevScreenContainer;
    prevScreen = ownChild(prevScreenContainer, attrSelector(SCREEN_ATTR));
    prevDecorator = ownChild(prevScreenContainer, attrSelector(DECORATOR_ATTR));

    if (!prevScreen) {
      isTouchPrevented = false;
      return;
    }

    swipeActive = true;
    holdNativeDrag();
    // The wake this gesture is about to trigger lands on the next commits;
    // hold the motion until it has been painted (see the reveal hold). A
    // screen that was never frozen is already displayed here, and then there
    // is nothing to wait for — the hold costs that gesture nothing.
    revealResolved = prevScreenRevealed();
    revealSeenAt = 0;
    revealHeldUntil =
      (typeof performance === "undefined" ? Date.now() : performance.now()) + REVEAL_HOLD_CAP_MS;
    swipeMaxDragPx = 0;
    swipeStartPoint = { x: event.clientX, y: event.clientY };
    swipeLastPoint = { x: event.clientX, y: event.clientY };
    swipeLastTime = event.timeStamp;
    swipeVelocity = { x: 0, y: 0 };
    velocityTrail = [{ t: event.timeStamp, x: event.clientX, y: event.clientY }];
    scope.setPointerCapture(event.pointerId);
    captureRidingBars(prevScreenContainer, scope);
    capturePartTransitions(prevScreenContainer);
    holdDragLayers();

    const decoratorDef = config.getDecorator();
    const isTriggered = await transition.onSwipeStart(event, buildSwipeInfo(event), {
      animate: animateSwipe,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      onStart: (triggered) => {
        decoratorDef?.onSwipeStart?.(triggered, {
          animate: animateInline,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        drivePartTransitions("start", triggered, 0);
      }
    });

    if (isTriggered && !forceCancelRequested) {
      config.setDragStatus("PENDING");
      // AFTER the unfreeze, not before it.
      //
      // The screen this drag reveals is Activity-hidden until `setDragStatus`
      // above reaches a commit, and hidden means `display: none`: every rect
      // inside it reads zero. Measuring there pinned the returning screen's
      // parts at the layer's origin with no size — seen on a real swipe as an
      // icon and a badge drawn clipped into the top-left corner. One frame is
      // what the binding needs to paint the screen it was told to reveal.
      //
      // Both of these read the DOM, so both wait: the staging measures rects,
      // and the riders measure nothing but must not lift a part the staging
      // declined to move.
      //
      // ONE FRAME IS NOT A PROMISE. The unfreeze is a store write, a React
      // render and an <Activity> reveal, and how many frames that takes is not
      // this file's to know — so the attempt repeats from the drag itself until
      // it takes. It is idempotent and costs a null check once it has.
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(armDragRiders);
      else armDragRiders();
      // The drag is CONFIRMED here, not in the handler's `onStart`: every
      // built-in transition returns `true` from `onSwipeStart` without ever
      // calling that callback, so anything hung off it never runs. This is the
      // controller's own moment and fires for whatever the author wrote.
      config.onDragStart?.();
    } else if (!isTriggered) {
      config.setDragStatus("IDLE");
      swipeActive = false;
      isTouchPrevented = false;
      releaseNativeDrag();
      releasePointerCapture(event);
      releaseRidingBars();
      releaseDragLayers();
      releasePartTransitions();
      releaseDragParts();
      riderSwipe?.settle(false, 0);
      riderSwipe = null;
    }
  };

  const startSwipe = (event: PointerEvent) => {
    const promise = beginSwipe(event);
    swipeStartPromise = promise;
    void promise.finally(() => {
      swipeStartPromise = null;
    });
  };

  // WHY THIS FOLLOW IS 30Hz ON iOS LOW POWER MODE, AND WHY THAT IS THE FLOOR.
  //
  // A drag on that device is visibly steppier than the same motion played as a
  // transition, and it is tempting to read that as something this file does
  // wrong. It is not. Measured on the device, with the page in a production
  // build and no inspector attached:
  //
  //   - requestAnimationFrame is capped at 30Hz (33ms between frames, even
  //     while the page is idle), and the cap is unconditional — media playback
  //     does not lift it.
  //   - The compositor keeps running at 60Hz in the same moment: an untouched
  //     CSS animation is smooth, including three viewport-sized layers with
  //     real content, and including while a finger rests on the glass.
  //   - Any main-thread mutation of a running compositor animation, at that
  //     30Hz cadence, costs its smoothness. Proven with the tracking removed
  //     entirely: an animation that ignored the finger, nudged only by
  //     `playbackRate = 1.02 / 0.98` every 33ms — visually a no-op — went
  //     rough, while the identical animation left alone stayed smooth.
  //
  // So following a finger costs 30Hz: to track it we must commit, and each
  // commit is charged. FALSIFIED ON THE DEVICE, do not retry:
  //   1. Cutting per-frame work (fewer writes, native listeners instead of
  //      React's, no forced reflow) — the cap is not a throughput problem.
  //   2. Short compositor segments (33ms / 100ms chained transitions).
  //   3. Long segments (250ms) with velocity dead reckoning — smooth, but each
  //      re-aim jumps, and computing the true current position analytically to
  //      remove the jump did not save it.
  //   4. Resampling at the frame's own timestamp from a coalesced-event buffer
  //      (the regularity hypothesis).
  //   5. Velocity control: one long animation, never restarted, whose
  //      playbackRate follows the finger — per frame, and on 120/200/320ms
  //      cadences, and on an error threshold with step-free correction.
  //   6. Driving a hidden 1x1 scroller (its timeline reaching the screens via
  //      `timeline-scope`, so nothing wraps them) with `scrollTo({behavior:
  //      "smooth"})` — the scrolling thread does NOT charge the toll above, but
  //      the UA picks the scroll animation's length and easing, so the motion
  //      trails the finger no matter how the destination is fed.
  //
  // The one gesture that IS smooth there is a scroll the finger drives
  // directly — which requires the screens to live inside a scroller with their
  // visual position decoupled (sticky), plus a gutter to scroll against. That
  // structure was weighed and rejected: it lands hit-testing, nested routers,
  // scroll restoration and consumer CSS on top of a scroller, and it cannot
  // serve y-axis transitions at all (the gesture axis collides with content
  // scrolling, iOS locks the scroll chain at gesture start, and a vertical
  // root scroll opens and closes the address bar).
  //
  // Blink does not charge any of this, which is why the same code is smooth on
  // Android in battery saver. Nothing here changes until WebKit stops capping
  // the main thread in Low Power Mode, decouples compositor animation updates
  // from that cap, or ships an off-main-thread animation API.
  //
  // ONE follow write per animation frame. Pointer moves arrive faster than
  // frames — a finger delivers several per frame, and more still on a device
  // whose frames are long — and every one of them used to run the whole
  // follow: both screens, the riding bars, the dim and every <Part>, each
  // write invalidating style again. Measured on a 10x-throttled mobile
  // Chromium, one drag: 61 moves → 172 style recalculations. The samples in
  // between never reach the glass; only the last one before the frame does.
  // Velocity still samples EVERY move (see pointerMove) — it is arithmetic on
  // the event, and the release threshold reads it.
  let pendingMove: PointerEvent | null = null;
  let followFrame = 0;

  // THE REVEAL HOLD.
  //
  // The screen a back-swipe reveals is usually FROZEN — React's <Activity>
  // hid it and unmounted its effects when it was covered — and starting the
  // gesture is what wakes it. That wake is a commit over the whole screen
  // subtree (its effects, and whatever the consumer re-subscribes there), and
  // it lands on the first frames of the drag: measured on a device at 6x CPU
  // throttle as one ~53ms task at the very start, with the rest of the drag
  // clean. It reads as the drag catching once and then running.
  //
  // Waking earlier was rejected: it would pay that commit on every touch that
  // never becomes a swipe. So the motion WAITS for it instead. Nothing moves
  // until the revealed screen is actually displayed and has had a frame to
  // paint; then the follow resumes from the finger's CURRENT position, so the
  // gesture picks up where the finger is rather than replaying what it missed.
  // The opening is a frame or two late and everything after it is continuous
  // — the same trade the flight's anim-hold makes for a push.
  //
  // Costs nothing where there is nothing to wake: a screen that was never
  // frozen is already displayed at the first check, and the hold releases in
  // that same frame.
  const REVEAL_HOLD_CAP_MS = 200;
  let revealHeldUntil = 0;
  let revealResolved = true;

  const prevScreenRevealed = () => {
    const container = prevScreen?.parentElement;
    if (!container || !container.isConnected) return true;
    if (typeof getComputedStyle !== "function") return true;
    return getComputedStyle(container).display !== "none";
  };

  // Called once per follow frame while the hold is up. Returns true when the
  // motion may run: the screen is displayed AND one frame has passed since, so
  // the reveal has been painted rather than merely committed.
  let revealSeenAt = 0;
  const revealHoldReleased = (now: number) => {
    if (revealResolved) return true;
    if (now >= revealHeldUntil) {
      // Cap: a wake that never lands must not strand the gesture.
      revealResolved = true;
      return true;
    }
    if (!prevScreenRevealed()) {
      revealSeenAt = 0;
      return false;
    }
    if (!revealSeenAt) {
      revealSeenAt = now;
      return false; // displayed this frame; let it paint before moving
    }
    revealResolved = true;
    return true;
  };

  // The release must settle from where the finger actually left the screen,
  // not from the last sample that happened to win a frame — so the trailing
  // move is written out synchronously before the settle is authored.
  const flushPendingFollow = () => {
    if (followFrame && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(followFrame);
    }
    followFrame = 0;
    // A release is not held: the gesture is over, and its settle is authored
    // from where the finger actually left.
    revealResolved = true;
    const trailing = pendingMove;
    pendingMove = null;
    if (trailing) continueSwipe(trailing);
  };

  const flushFollow = (
    now = typeof performance === "undefined" ? Date.now() : performance.now()
  ) => {
    followFrame = 0;
    if (!revealHoldReleased(now)) {
      // Keep the sample and look again next frame: the finger's position when
      // the hold lifts is the one the motion resumes from.
      if (pendingMove && typeof requestAnimationFrame === "function") {
        followFrame = requestAnimationFrame(flushFollow);
      }
      return;
    }
    const event = pendingMove;
    pendingMove = null;
    if (event) continueSwipe(event);
  };

  const queueFollow = (event: PointerEvent) => {
    pendingMove = event;
    if (followFrame) return;
    // No rAF (exotic embedder, jsdom): follow synchronously, as before.
    if (typeof requestAnimationFrame !== "function") {
      flushFollow();
      return;
    }
    followFrame = requestAnimationFrame(flushFollow);
  };

  const continueSwipe = (event: PointerEvent) => {
    const transition = config.getTransition();
    if (
      !transition.swipeDirection ||
      !swipeActive ||
      swipeStartPromise ||
      config.getViewportScrollHeight() > 10
    )
      return;

    const { scope, decorator } = config.getElements();
    const decoratorDef = config.getDecorator();
    const info = buildSwipeInfo(event);
    // THE GESTURE'S OWN PROGRESS, not the handler's.
    //
    // A transition's `progress` means whatever its author decided — cupertino
    // divides the drag by `window.innerWidth` — and that is only the same
    // question for a Router that fills the window. Inside a contained one it
    // is a different denominator entirely: a full drag across a 378px stage in
    // a 1500px window reads as 8% travelled, so anything driven by it barely
    // moves and the release has to rush the rest. The screen being dragged is
    // the span that matters, which is the same one the release already scales
    // by below.
    const dragAxis = transition.swipeDirection;
    const dragBox = scope?.getBoundingClientRect();
    const dragSpan =
      (dragAxis === "y" ? dragBox?.height : dragBox?.width) ||
      /* v8 ignore start -- no window means no pointer event to have started a
         drag, so this arm cannot run; it is here for the same SSR-safety the
         release's own span keeps a few lines below. */
      (typeof window === "undefined"
        ? 0
        : dragAxis === "y"
          ? window.innerHeight
          : window.innerWidth);
    /* v8 ignore stop */
    const dragged = Math.abs(dragAxis === "y" ? info.offset.y : info.offset.x);
    // THE GESTURE'S PROGRESS, 0-100, which is what a decorator's and a part's
    // hooks are documented to receive ("the drag `progress` (0-100)").
    //
    // They used to receive whatever the TRANSITION passed to `onProgress`, and
    // that is the author's own number in the author's own unit: cupertino sent
    // 0-100 against `window.innerWidth`, material sends its 0-56 pull in
    // PIXELS, and layout sends the literal 100 on every frame. So a decorator
    // written to the documented contract behaved differently under each of
    // them — `1 - progress / 100` only ever reaches 0.44 on material and snaps
    // to 0 on the first frame under layout — and under cupertino it was
    // measured against the wrong box: a dim over a 348px screen in a 1275px
    // window moved 12% while the screen moved 45%.
    //
    // The controller is the only party that knows the box being dragged, so it
    // is the only one that can answer this question for every transition at
    // once. The handler's own number stays the handler's own business.
    /* v8 ignore next 2 -- the zero arm needs both an unlaid-out screen and no
       window to fall back to, which is the same guard `dragSpan` above keeps
       and the same reason it cannot run under a pointer event. */
    const gestureProgress =
      dragSpan > 0 ? Math.max(0, Math.min(100, (dragged / dragSpan) * 100)) : 0;

    transition.onSwipe(event, info, {
      animate: animateSwipe,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      // `triggered` is the handler's to report; the progress is not. See
      // gestureProgress above.
      onProgress: (triggered) => {
        decoratorDef?.onSwipe?.(triggered, gestureProgress, {
          animate: animateInline,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        drivePartTransitions("swipe", triggered, gestureProgress);
        // Until it takes: the screen these belong to is revealed by the drag
        // itself, and the frame that lands on is not ours to predict.
        armDragRiders();
        // The same span everything else reads, in the 0-1 form the scrub takes.
        riderSwipe?.scrub(gestureProgress / 100);
      }
    });
    // The morph runtime already took this number, in its own 0-1 form, and has
    // done since the contained-Router case was found. Everything the gesture
    // drives now reads the same span.
    config.onDragProgress?.(gestureProgress / 100);
  };

  const endSwipe = async (event: PointerEvent, forceCancel = false) => {
    if (swipeStartPromise) await swipeStartPromise;
    const transition = config.getTransition();
    if (!transition.swipeDirection || !swipeActive) return;

    flushPendingFollow();
    swipeActive = false;
    releaseNativeDrag();
    const { scope, decorator } = config.getElements();
    releasePointerCapture(event);

    const decoratorDef = config.getDecorator();
    // Sub-slop release = a tap, not a swipe: clamp the handler's settle
    // durations to zero so the restore is instantaneous and no settle
    // animation exists to fight a navigation the same tap triggered.
    //
    // A FORCED CANCEL IS NOT A TAP, and it used to be treated as one. That is
    // how a gesture that had already carried a screen a third of the way
    // across teleported it back to rest in a single frame: measured off a
    // screen recording at 60fps, 176px to rest between two consecutive frames,
    // with no pop. `abandon` states the intended rule in so many words — "a
    // recovery that teleported the screen would trade one visible defect for
    // another" — and the code disagreed with it. Only the slop rule stands.
    const tapLike = swipeMaxDragPx < SWIPE_TAP_SLOP_PX;

    // `pointercancel` means the browser/OS took ownership (usually a native
    // scroll). It can arrive with a noisy offset and velocity; feeding those
    // into an ordinary swipe end may satisfy a consumer's commit threshold.
    // Settle from a neutral sample and ignore any trigger result instead.
    const swipeInfo = forceCancel
      ? {
          point: { x: event.clientX, y: event.clientY },
          offset: { x: 0, y: 0 },
          delta: { x: 0, y: 0 },
          velocity: { x: 0, y: 0 }
        }
      : buildSwipeInfo(event);

    // ...but the SETTLE still has to know how far there is to walk back. The
    // neutral sample exists so the HANDLER cannot read a cancel as a commit;
    // handing it to the release clock as well says the screen has nowhere to
    // travel, and `swipeSettleSeconds` answers a zero distance with zero
    // seconds, which is the teleport again by a second route. So the offset it
    // scales by is the real one, while the velocity stays neutral: a cancel
    // borrows no momentum from a gesture the browser took away.
    const settleOffset = forceCancel ? buildSwipeInfo(event).offset : swipeInfo.offset;

    // THE RELEASE CLOCK, for every transition — the shipped presets, and every
    // one a consumer will ever write.
    //
    // A release is the continuation of a gesture, so its length belongs to the
    // gesture: what is LEFT to travel and how fast the finger was going. An
    // authored duration cannot know either — it is one number for every
    // release — so a handler that writes `duration: 0.3` runs the same clock
    // whether six pixels or three hundred remain, and the same navigation
    // lands in a different time depending on how it was started. Measured on a
    // device: cupertino's release at a flat 0.3s against the identical pop
    // driven by a button at 0.78s.
    //
    // So the authored duration becomes the CEILING and this scales it down to
    // what the gesture asks for (swipeSettleSeconds). It applies here, at the
    // one place every release write passes through — the transition's own
    // hooks, its decorator's, and its parts' — rather than in any preset, so a
    // transition written tomorrow gets it without asking, and one that wants
    // a flat clock still names its own ceiling.
    const axis = transition.swipeDirection;
    const box = scope?.getBoundingClientRect();
    const span =
      (axis === "y" ? box?.height : box?.width) ||
      (typeof window === "undefined" ? 0 : axis === "y" ? window.innerHeight : window.innerWidth);
    const offsetOnAxis = axis === "y" ? settleOffset.y : settleOffset.x;
    const velocityOnAxis = axis === "y" ? swipeInfo.velocity.y : swipeInfo.velocity.x;
    const travelled = Math.abs(offsetOnAxis);
    const speed = Math.abs(velocityOnAxis);
    // Does the finger still HELP? A completion always travels the way the
    // finger went, so it never reverses. A cancel walks back — a reversal
    // unless the finger had already turned around and is carrying it home.
    //
    // "Carrying it home" has to mean something: a finger that merely eases off
    // registers a few px/s backwards at release (device-traced: a small drag
    // released gently still read as heading back, which handed the cancel the
    // short floor it was supposed to escape). Only a deliberate flick back
    // counts.
    const TOWARD_REST_MIN_PX_PER_S = 300;
    const travelSign = Math.sign(offsetOnAxis);
    const fingerHeadingBack =
      travelSign !== 0 &&
      Math.sign(velocityOnAxis) === -travelSign &&
      speed >= TOWARD_REST_MIN_PX_PER_S;
    // Read at WRITE time, not now: a handler reports its verdict through
    // `onStart` before it animates (every preset does), and until it does the
    // conservative reading is the cancel — the distance back to rest.
    let releaseTriggered = false;
    // The seconds the SCREENS were given, kept so anything else the release
    // drives lands with them rather than on a clock of its own.
    let settleSeconds: number | null = null;
    let settleReported = false;
    // Reported the MOMENT the release is decided, not after the handler's own
    // settle resolves. A handler awaits its screen animations — cupertino
    // awaits every one of them — so anything hung off that await sits frozen
    // for the whole settle and only then moves. On glass: the shared element
    // stops dead under the finger, waits out the screen, and only then goes
    // back. The verdict and the clock are both known here, which is where the
    // screens themselves start moving.
    const reportSettle = (committed: boolean, seconds: number) => {
      if (settleReported) return;
      settleReported = true;
      config.onDragSettle?.(committed, seconds);
      // The riders settle on the SAME number the morph and the screens do, so
      // everything the gesture was carrying lands together.
      riderSwipe?.settle(committed, seconds);
      riderSwipe = null;
    };

    const gestureScaled = <T extends typeof animateInline>(
      write: T,
      ceiling?: CeilingOverride
    ): T =>
      ((target, value, options) => {
        // Whether THIS write is one of the screens'. The release scales every
        // participant's clock — screens, bars, the decorator, parts — and each
        // names its own ceiling, EXCEPT the decorator, which is handed the
        // screens' (see releaseCeiling below). What rides the gesture from
        // outside is given the screens' number too, or it lands early: a shared
        // element handed the decorator's clock finished 21px before the screen
        // carrying its slot did, then jumped the difference on landing.
        const isScreenWrite = target === scope || target === prevScreen;
        // An explicit zero is a snap the author asked for and survives any
        // ceiling: it is how a handler says "put this there now".
        const authoredOwn = typeof options?.duration === "number" ? options.duration : 0;
        if (authoredOwn <= 0) return write(target, value, options);
        const authored = ceiling?.seconds ?? authoredOwn;
        const remainingPx = releaseTriggered ? span - travelled : travelled;
        const reversing = !releaseTriggered && !fingerHeadingBack;
        const authoredEase = easeControlPoints(options?.ease);
        // The curve the DISTANCE term reads. A borrowed ceiling brings its own,
        // and brings it whole: falling back to this write's curve when the
        // ceiling has none would pair the ceiling's span with a different
        // curve, which is the mismatch this is here to prevent. Without a
        // ceiling it is the write's own.
        const distanceEase = ceiling ? ceiling.ease : authoredEase;
        const seconds = swipeSettleSeconds({
          remainingPx,
          spanPx: span,
          velocityPxPerSecond: speed,
          authoredSeconds: authored,
          // The distance term is the time the authored curve spends on the
          // stretch that is left, so it needs the curve.
          authoredEase: distanceEase,
          reversing
        });
        // ...and the curve, on the same gesture. The length alone decides the
        // AVERAGE speed; what the eye reads at the moment the finger leaves is
        // the curve's speed at t=0, and an authored curve opens fast because it
        // starts from rest. Re-aim it to leave at the speed the finger had.
        //
        // Cancels included: a reversal contributes zero speed in the settle's
        // own direction, so it lands on the floor and opens like the standing
        // screen it is. One rule — the release leaves at the speed the screen
        // already had — rather than one for a commit and another for a cancel.
        if (settleSeconds === null) settleSeconds = seconds;
        if (isScreenWrite) reportSettle(releaseTriggered, seconds);
        const slope = authoredEase
          ? releaseLaunchSlope({
              remainingPx,
              velocityPxPerSecond: speed,
              seconds,
              authoredSlope: authoredEase[0] > 0 ? authoredEase[1] / authoredEase[0] : undefined,
              reversing
            })
          : null;
        return write(target, value, {
          ...options,
          duration: seconds,
          ...(authoredEase && slope !== null ? { ease: reaimReleaseEase(authoredEase, slope) } : {})
        });
      }) as T;

    // THE SCREENS' CEILING, for the decorator to borrow.
    //
    // A decorator has no clock of its own on the programmatic path any more
    // (resolveDecoratorClock): it runs for exactly as long as the screen it
    // dresses. A release must not undo that, and `overlay` is what it looked
    // like when it did — its handler named 0.3s against cupertino's 0.7s, a
    // number left over from before the settle existed, so a swipe-completed pop
    // cleared the dim while the screen was still sliding, while the same pop
    // from a button held the two together.
    //
    // It cannot be taken from `settleSeconds` after the fact: a decorator's
    // hook fires from `onStart`, which every handler calls BEFORE it animates
    // its screens, so at that moment no screen has been written. So it is read
    // from the transition's own variant table instead, which is where the
    // handler's own ceiling comes from. A swipe is always a swipe-BACK, so the
    // variant is the pop, and the active side is the screen under the finger.
    //
    // The CURVE is not borrowed, only the span: the decorator keeps writing
    // whatever curve its author drew, exactly as it does on the compiled path,
    // where a dim deliberately declines the screen's positional easing.
    const screenReleaseMotion = resolveVariantMotion(transition, "POPPING-true");
    const releaseCeiling: CeilingOverride | undefined = screenReleaseMotion
      ? {
          seconds: screenReleaseMotion.duration,
          ease: easeControlPoints(screenReleaseMotion.ease)
        }
      : undefined;

    const animateForEnd: typeof animateSwipe = tapLike
      ? (target, value, options) => animateSwipe(target, value, { ...options, duration: 0 })
      : gestureScaled(animateSwipe);
    const animateDecoratorForEnd: typeof animateInline = tapLike
      ? (target, value, options) => animateInline(target, value, { ...options, duration: 0 })
      : gestureScaled(animateInline, releaseCeiling);
    // A PART keeps its own ceiling, and that is not an oversight. A part is
    // referenced by name and is not bound to any transition, so it has no
    // screen clock to inherit in the first place; authoring its own span is
    // how a part says "leave in the first fifth of the flight". Borrowing the
    // screen's here would stretch every such part to the full release.
    const animatePartForEnd: typeof animateInline = tapLike
      ? (target, value, options) =>
          animateInline(target, value, { ...options, duration: 0 }, layerOwner)
      : gestureScaled((target, value, options) =>
          animateInline(target, value, options, layerOwner)
        );
    const handlerTriggered = await transition.onSwipeEnd(event, swipeInfo, {
      animate: animateForEnd,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      onStart: (triggered) => {
        const settledTrigger = forceCancel ? false : triggered;
        // The verdict decides what is LEFT to travel, so the release clock
        // reads it from here on.
        releaseTriggered = settledTrigger;
        decoratorDef?.onSwipeEnd?.(settledTrigger, {
          animate: animateDecoratorForEnd,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        drivePartTransitions("end", settledTrigger, 0, animatePartForEnd);
      }
    });
    const isTriggered = !forceCancel && handlerTriggered;
    // A tap-like release wrote everything at zero duration and never reached
    // the scaler above, so there is no settle to share: whatever the binding
    // drives lands at once too.
    reportSettle(isTriggered, tapLike ? 0 : (settleSeconds ?? 0));

    if (isTriggered) {
      // The swipe already animated the screen out. Suppress the upcoming
      // POPPING keyframe so it doesn't snap back to its `from` value first.
      scope?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      decorator?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      // Current-side bars unmount with the current screen via back(). Prev-side
      // bars outlive the navigation: strip the inline transforms so they don't
      // shadow the next compiled rule, but demote their layers off-cadence —
      // the swiped-out landing is a convergence like any other (see
      // layerSettleHold.ts).
      for (const bar of ridingBars.current) releaseScopeLayerAfterSettle(bar, layerOwner);
      for (const bar of ridingBars.prev) {
        clearInlineAnimation(bar, undefined, layerOwner);
        releaseScopeLayerAfterSettle(bar, layerOwner);
      }
      ridingBars = { current: [], prev: [] };
      // Current-side part elements unmount with the screen. The previous
      // side's inline values are the swipe hooks' LANDING state — the same
      // values its post-commit rest rules resolve to — so they stay put
      // (stripping here would flash the pre-swipe state for a frame); the
      // engine's COMPLETED cleanup strips them once the rest rules own the
      // element.
      partEls = { current: [], prev: [] };
      // Home BEFORE the commit, so the landing flight's own staging finds them
      // in their bar and takes them over cleanly. Handing the same elements
      // across would not work: stageBarParts collects from the bar, so parts
      // already up in the layer read as nothing to stage, and the drag's
      // release would then pull them home in the middle of the pop. Same task
      // as `back()`, so no frame is painted with them back in place.
      releaseDragParts();
      config.back();
      // Hand the drag promotion back. A hold is owned, and the engine's
      // COMPLETED cleanup releases under ITS owner — a release this owner
      // never makes is a release that never happens, and the screen the swipe
      // dragged IN survives the navigation carrying `will-change: transform`
      // for the rest of the session. That is not merely a resident layer: it
      // makes the scope a containing block, so a consumer's `position: fixed`
      // overlay stays trapped under the shared bars from the first swipe on.
      //
      // After `back()`, so the landing flight has already re-held these
      // elements under the engine's owner: the union keeps them promoted and
      // nothing demotes between the two.
      releaseDragLayers();
    } else {
      // Cancel: animation already played back to rest. Clear inline styles so
      // the CSS rest rule resumes ownership.
      if (scope) clearInlineAnimation(scope, undefined, layerOwner);
      if (prevScreen) clearInlineAnimation(prevScreen, undefined, layerOwner);
      if (decorator) clearInlineAnimation(decorator);
      if (prevDecorator) clearInlineAnimation(prevDecorator);
      releaseRidingBars();
      releaseDragLayers();
      releasePartTransitions();
      // After releasePartTransitions, which strips the drag's inline writes
      // while the parts are still where the gesture left them.
      releaseDragParts();
      config.setDragStatus("IDLE");
    }
  };

  const pointerDown = (event: PointerEvent) => {
    // A second finger, or a non-left mouse button: proves nothing about the
    // gesture in flight and starts nothing of its own.
    if (event.isPrimary === false || (event.pointerType === "mouse" && event.button !== 0)) return;

    // A PRIMARY pointer going down is proof that no other pointer is down —
    // that is what primary MEANS for touch. So a gesture still marked active
    // here belongs to a pointer that is already gone, and its closing event is
    // never coming. Take it out.
    //
    // BEFORE the readiness gate, deliberately. Readiness governs whether a NEW
    // drag may start; it says nothing about cleaning up a dead one — and while
    // a stale gesture is around, readiness is closed precisely BECAUSE of it
    // (dragStatus sits at PENDING), so a recovery behind that gate never runs.
    //
    // Standing aside is what used to happen (`swipeActive` was part of the
    // guard below) and it deadlocked: the abandoned gesture keeps
    // `isTouchPrevented` armed, every touchmove on the screen is
    // preventDefault-ed, the screen cannot scroll — and this function, the one
    // place that would clear the flag, refuses to run because the gesture is
    // active. Device-reported on Safari, which drops the remaining pointer
    // events when the element holding capture is removed or hidden (Blink
    // retargets them to the document and recovers on its own).
    if (swipeActive || activePointerId !== null) abandon();

    // Before intent resolves we do not own pointer capture, so a release
    // outside the scope may never deliver pointerup/pointercancel. Letting the
    // next primary pointer replace that stale candidate is the same rule.
    if (!config.isReadyForDrag()) return;

    activePointerId = event.pointerId;
    forceCancelRequested = false;
    shouldStartDrag = true;
    isTouchPrevented = false;

    scrollableX = findScrollable(event.target, { direction: "x", verifyByScroll: true });
    scrollableY = findScrollable(event.target, { direction: "y", verifyByScroll: true });

    startX = event.clientX;
    startY = event.clientY;
  };

  const pointerMove = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    if (config.getViewportScrollHeight() > 10) return;

    if (swipeActive) {
      updateSwipeVelocity(event);
      queueFollow(event);
      return;
    }

    if (!shouldStartDrag) return;
    if (!config.isReadyForDrag()) {
      shouldStartDrag = false;
      return;
    }

    const swipeDirection = config.getTransition().swipeDirection;
    if (!swipeDirection) {
      shouldStartDrag = false;
      return;
    }
    const hasNoScrollable = !scrollableX.element && !scrollableY.element;
    const x = event.clientX - startX;
    const y = event.clientY - startY;
    const primary = swipeDirection === "x" ? x : y;
    const cross = swipeDirection === "x" ? y : x;

    if (Math.max(Math.abs(primary), Math.abs(cross)) < SWIPE_INTENT_SLOP_PX) return;

    // Resolve the stream exactly once. An opposite or cross-axis-dominant
    // movement belongs to native scrolling for the rest of this pointer;
    // it must never be reconsidered after the finger changes course.
    shouldStartDrag = false;
    if (primary <= 0 || Math.abs(primary) <= Math.abs(cross) * SWIPE_AXIS_DOMINANCE_RATIO) return;

    if (hasNoScrollable) {
      isTouchPrevented = true;
      startSwipe(event);
    } else {
      const isTopAtEdge = scrollableY.element && scrollableY.element.scrollTop <= 0;
      const isLeftAtEdge =
        scrollableX.element && scrollableX.element.scrollLeft <= 0 && scrollableX.hasMarker;

      if (swipeDirection === "y" && (isTopAtEdge || !!scrollableX.element)) {
        isTouchPrevented = true;
        startSwipe(event);
      } else if (swipeDirection === "x" && (isLeftAtEdge || !!scrollableY.element)) {
        isTouchPrevented = true;
        startSwipe(event);
      }
    }
  };

  const pointerUp = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    shouldStartDrag = false;
    isTouchPrevented = false;
    // The pointer is gone, so the suppression goes with it — here rather than
    // in `endSwipe`, which awaits the start promise before it runs and would
    // leave selection disabled across that gap.
    releaseNativeDrag();
    activePointerId = null;
    if (swipeActive) {
      void endSwipe(event);
    }
  };

  const pointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    shouldStartDrag = false;
    isTouchPrevented = false;
    releaseNativeDrag();
    activePointerId = null;
    forceCancelRequested = true;
    if (swipeActive) {
      void endSwipe(event, true);
    }
  };

  /**
   * Losing capture without an up or a cancel means the element went out from
   * under the gesture. Treat it as the cancel the browser did not send.
   *
   * ONLY when the SCOPE is what lost it. A touch pointer is given IMPLICIT
   * capture on whatever element it landed on — a child, in any real screen —
   * and `beginSwipe` then captures it onto the scope. That transfer fires
   * `lostpointercapture` on the child, and the event BUBBLES to the scope,
   * where this binding listens. Reacting to it cancels the gesture at the exact
   * moment it is being set up, so every touch swipe dies on its first frame.
   *
   * Device-reported, and invisible to everything cheaper: a mouse gets no
   * implicit capture, so there is no transfer and no event — every mouse-driven
   * test and headless probe passes. jsdom has no pointer capture at all.
   */
  const lostPointerCapture = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId || !swipeActive) return;
    if (event.target !== config.getElements().scope) return;
    pointerCancel(event);
  };

  /**
   * End a gesture that has no pointer left to end it.
   *
   * Synthesises the cancel for whichever pointer is active and runs the
   * ordinary cancel path, so the screen settles back to rest exactly as a real
   * `pointercancel` would settle it — this is a recovery, and a recovery that
   * teleported the screen would trade one visible defect for another. With no
   * gesture in flight it still clears the arming flags, which is the state that
   * actually blocks scrolling.
   */
  function abandon() {
    const pointerId = activePointerId;
    shouldStartDrag = false;
    isTouchPrevented = false;
    // Unconditionally: an abandoned gesture that left the suppression armed
    // would take the consumer's text selection away for the rest of the
    // session, which is worse than the defect it is here to cure.
    releaseNativeDrag();
    if (pointerId === null) {
      // Nothing captured, nothing to settle: just make sure nothing is armed.
      return;
    }
    pointerCancel({
      pointerId,
      clientX: swipeLastPoint.x,
      clientY: swipeLastPoint.y,
      timeStamp: swipeLastTime
    } as PointerEvent);
    activePointerId = null;
  }

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    lostPointerCapture,
    abandon,
    shouldPreventTouch: () => isTouchPrevented
  };
}

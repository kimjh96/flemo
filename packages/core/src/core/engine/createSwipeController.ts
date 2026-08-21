import animateInline, { clearInlineAnimation } from "@transition/animateInline";

import type { Transition } from "@transition/typing";

import findScrollable from "@utils/findScrollable";

import { holdScopeLayer, releaseScopeLayerAfterSettle } from "@core/engine/layerSettleHold";

import { sharedBarsMatch, type SharedBarPresenceLike } from "@screen/computeBarRiding";

import { partTransitionMap } from "@transition/partTransition/partTransition";

import type { SharedBarId, SharedBarsMetadata } from "@screen/store";

import type { Decorator } from "@transition/decorator/typing";

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
}

export interface SwipeController {
  pointerDown: (event: PointerEvent) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: (event: PointerEvent) => void;
  pointerCancel: (event: PointerEvent) => void;
  // Whether an in-progress drag wants touchmove default suppressed.
  shouldPreventTouch: () => boolean;
}

const SKIP_ANIMATION_ATTR = "data-flemo-skip-animation";

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
  let ridingBars: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };
  // <Part> elements on the current + previous screens, driven inline by
  // the drag progress (the interactive path; the programmatic path is CSS).
  let partEls: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };

  let shouldStartDrag = false;
  let isTouchPrevented = false;
  let swipeActive = false;
  let activePointerId: number | null = null;
  let swipeStartPromise: Promise<void> | null = null;
  let forceCancelRequested = false;

  let swipeStartPoint = { x: 0, y: 0 };
  let swipeLastPoint = { x: 0, y: 0 };
  let swipeLastTime = 0;
  let swipeVelocity = { x: 0, y: 0 };

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

  const updateSwipeVelocity = (event: PointerEvent) => {
    const now = event.timeStamp;
    const dt = Math.max(1, now - swipeLastTime);
    swipeVelocity = {
      x: ((event.clientX - swipeLastPoint.x) / dt) * 1000,
      y: ((event.clientY - swipeLastPoint.y) / dt) * 1000
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
    if (target === config.getElements().scope) {
      for (const bar of ridingBars.current) animateInline(bar, value, options, layerOwner);
    } else if (target === prevScreen) {
      for (const bar of ridingBars.prev) animateInline(bar, value, options, layerOwner);
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

  const captureRidingBars = (prevScreenContainer: HTMLElement | null) => {
    const partnerBars = config.getPartnerBars();
    const partnerMetadata = config.getPartnerBarMetadata?.();
    // A previous screen can have committed its DOM before its Activity-
    // reconnected layout effects republish the registry. Use that DOM as the
    // synchronous fallback so the first swipe tick keeps legacy behavior.
    const prevTopBar = ownChild(prevScreenContainer, '[data-flemo-bar="app"]');
    const prevNavBar = ownChild(prevScreenContainer, '[data-flemo-bar="nav"]');
    const domMetadata = (bar: HTMLElement | null | undefined) => {
      if (!bar) return undefined;
      const value = bar.getAttribute("data-flemo-bar-id");
      if (value === null) return {};
      return {
        id: bar.getAttribute("data-flemo-bar-id-type") === "number" ? Number(value) : value
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

    ridingBars = { current, prev };

    // Pre-promote the riding bars so the first inline write doesn't pay layer
    // creation. Routed through the settle hold (not a bare style write) so a
    // swipe starting inside a previous release's settle window cancels the
    // pending demotion — otherwise that timer would strip `will-change`
    // mid-drag.
    for (const bar of current) holdScopeLayer(bar, config.getTransition(), false, layerOwner);
    for (const bar of prev) holdScopeLayer(bar, config.getTransition(), false, layerOwner);
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
      const ownScope = ownChild(root, "[data-flemo-screen]");
      return Array.from(root!.querySelectorAll<HTMLElement>("[data-flemo-part-name]")).filter(
        (part) => {
          const owner = part.closest("[data-flemo-screen]");
          return owner === null || owner === ownScope;
        }
      );
    };
    partEls = { current: select(screenContainer), prev: select(prevScreenContainer) };
  };

  // Drive each captured <Part> element through its registered
  // part-transition's swipe hook, passing whether it sits on the current
  // (active) or previous screen so the author can map the drag per side.
  const drivePartTransitions = (
    hook: "start" | "swipe" | "end",
    triggered: boolean,
    progress: number
  ) => {
    const run = (element: HTMLElement, active: boolean) => {
      // Selected by [data-flemo-part-name], so the attribute is present.
      const def = partTransitionMap.get(element.getAttribute("data-flemo-part-name")!);
      if (!def) return;
      // The part hook's writes must carry THIS controller's writer token —
      // releasePartTransitions clears under it, and an unstaked write would
      // never match that owner-scoped clear (leaking the inline values and
      // their leases past a cancelled swipe).
      const animate: typeof animateInline = (target, value, animOptions) =>
        animateInline(target, value, animOptions, layerOwner);
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
    prevScreen = ownChild(prevScreenContainer, "[data-flemo-screen]");
    prevDecorator = ownChild(prevScreenContainer, "[data-flemo-decorator]");

    if (!prevScreen) {
      isTouchPrevented = false;
      return;
    }

    swipeActive = true;
    swipeMaxDragPx = 0;
    swipeStartPoint = { x: event.clientX, y: event.clientY };
    swipeLastPoint = { x: event.clientX, y: event.clientY };
    swipeLastTime = event.timeStamp;
    swipeVelocity = { x: 0, y: 0 };
    scope.setPointerCapture(event.pointerId);
    captureRidingBars(prevScreenContainer);
    capturePartTransitions(prevScreenContainer);

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
    } else if (!isTriggered) {
      config.setDragStatus("IDLE");
      swipeActive = false;
      isTouchPrevented = false;
      releasePointerCapture(event);
      releaseRidingBars();
      releasePartTransitions();
    }
  };

  const startSwipe = (event: PointerEvent) => {
    const promise = beginSwipe(event);
    swipeStartPromise = promise;
    void promise.finally(() => {
      swipeStartPromise = null;
    });
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

    updateSwipeVelocity(event);

    const { scope, decorator } = config.getElements();
    const decoratorDef = config.getDecorator();
    transition.onSwipe(event, buildSwipeInfo(event), {
      animate: animateSwipe,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      onProgress: (triggered, progress) => {
        decoratorDef?.onSwipe?.(triggered, progress, {
          animate: animateInline,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        drivePartTransitions("swipe", triggered, progress);
      }
    });
  };

  const endSwipe = async (event: PointerEvent, forceCancel = false) => {
    if (swipeStartPromise) await swipeStartPromise;
    const transition = config.getTransition();
    if (!transition.swipeDirection || !swipeActive) return;

    swipeActive = false;
    const { scope, decorator } = config.getElements();
    releasePointerCapture(event);

    const decoratorDef = config.getDecorator();
    // Sub-slop release = a tap, not a swipe: clamp the handler's settle
    // durations to zero so the restore is instantaneous and no settle
    // animation exists to fight a navigation the same tap triggered.
    const tapLike = forceCancel || swipeMaxDragPx < SWIPE_TAP_SLOP_PX;
    const animateForEnd: typeof animateSwipe = tapLike
      ? (target, value, options) => animateSwipe(target, value, { ...options, duration: 0 })
      : animateSwipe;
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
    const handlerTriggered = await transition.onSwipeEnd(event, swipeInfo, {
      animate: animateForEnd,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      onStart: (triggered) => {
        const settledTrigger = forceCancel ? false : triggered;
        decoratorDef?.onSwipeEnd?.(settledTrigger, {
          animate: animateInline,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        drivePartTransitions("end", settledTrigger, 0);
      }
    });
    const isTriggered = !forceCancel && handlerTriggered;

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
      config.back();
    } else {
      // Cancel: animation already played back to rest. Clear inline styles so
      // the CSS rest rule resumes ownership.
      if (scope) clearInlineAnimation(scope, undefined, layerOwner);
      if (prevScreen) clearInlineAnimation(prevScreen, undefined, layerOwner);
      if (decorator) clearInlineAnimation(decorator);
      if (prevDecorator) clearInlineAnimation(prevDecorator);
      releaseRidingBars();
      releasePartTransitions();
      config.setDragStatus("IDLE");
    }
  };

  const pointerDown = (event: PointerEvent) => {
    // Before intent resolves we do not own pointer capture, so a release
    // outside the scope may never deliver pointerup/pointercancel. Let the
    // next primary pointer replace that stale candidate. `swipeActive` guards
    // captured gestures, while `isPrimary` rejects an actual second finger.
    if (
      !config.isReadyForDrag() ||
      swipeActive ||
      event.isPrimary === false ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;

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
      continueSwipe(event);
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
    activePointerId = null;
    if (swipeActive) {
      void endSwipe(event);
    }
  };

  const pointerCancel = (event: PointerEvent) => {
    if (event.pointerId !== activePointerId) return;
    shouldStartDrag = false;
    isTouchPrevented = false;
    activePointerId = null;
    forceCancelRequested = true;
    if (swipeActive) {
      void endSwipe(event, true);
    }
  };

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    pointerCancel,
    shouldPreventTouch: () => isTouchPrevented
  };
}

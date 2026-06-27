import animateInline, { clearInlineAnimation } from "@transition/animateInline";

import { collectAnimatedProperties } from "@transition/compileTransitionStyles";

import type { Transition } from "@transition/typing";

import findScrollable from "@utils/findScrollable";

import { barTransitionMap } from "@transition/barTransition/barTransition";

import type { Decorator } from "@transition/decorator/typing";

// Presence of a partner screen's shared bars, used to decide ride-along.
export interface SharedBarPresenceLike {
  appBar: boolean;
  navigationBar: boolean;
}

export interface SwipeControllerElements {
  scope: HTMLElement | null;
  // The screen container (parent of the scope) used to DOM-walk to the prev
  // screen's subtree at swipe start.
  screenContainer: HTMLElement | null;
  decorator: HTMLElement | null;
  sharedAppBar: HTMLElement | null;
  sharedNavigationBar: HTMLElement | null;
}

// Everything the controller needs from its host, read live so it reflects the
// binding's current render. No framework types — any binding can supply these.
export interface SwipeControllerConfig {
  getTransition: () => Transition;
  getDecorator: () => Decorator | undefined;
  getElements: () => SwipeControllerElements;
  hasSharedAppBar: () => boolean;
  hasSharedNavigationBar: () => boolean;
  getViewportScrollHeight: () => number;
  // The full readiness gate for starting a drag (isRoot / isActive / status /
  // dragStatus / swipeDirection / keyboard), computed by the binding.
  isReadyForDrag: () => boolean;
  // The partner screen's shared-bar presence (active screen looks one below,
  // an entering screen looks at the current top).
  getPartnerBars: () => SharedBarPresenceLike | undefined;
  setDragStatus: (status: "IDLE" | "PENDING") => void;
  // Commit a swipe-back navigation (window.history.back in the browser binding).
  back: () => void;
}

export interface SwipeController {
  pointerDown: (event: PointerEvent) => void;
  pointerMove: (event: PointerEvent) => void;
  pointerUp: (event: PointerEvent) => void;
  // Whether an in-progress drag wants touchmove default suppressed.
  shouldPreventTouch: () => boolean;
}

const SKIP_ANIMATION_ATTR = "data-flemo-skip-animation";

// Framework-neutral swipe-back gesture controller. Holds the gesture state that
// used to live as refs in ScreenMotion; the binding forwards native pointer
// events and supplies the live environment. A faithful port of the former
// ScreenMotion swipe handlers, so any binding gets identical behavior.
export default function createSwipeController(config: SwipeControllerConfig): SwipeController {
  let prevScreen: HTMLElement | null = null;
  let prevDecorator: HTMLElement | null = null;
  let ridingBars: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };
  // <BarTransition> elements on the current + previous screens, driven inline by
  // the drag progress (the interactive path; the programmatic path is CSS).
  let barTxEls: { current: HTMLElement[]; prev: HTMLElement[] } = { current: [], prev: [] };

  let shouldStartDrag = false;
  let isTouchPrevented = false;
  let swipeActive = false;

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

  const updateSwipeVelocity = (event: PointerEvent) => {
    const now = event.timeStamp;
    const dt = Math.max(1, now - swipeLastTime);
    swipeVelocity = {
      x: ((event.clientX - swipeLastPoint.x) / dt) * 1000,
      y: ((event.clientY - swipeLastPoint.y) / dt) * 1000
    };
    swipeLastPoint = { x: event.clientX, y: event.clientY };
    swipeLastTime = now;
  };

  // Mirror every write to a screen onto the bars that ride along with it, in
  // the SAME synchronous tick (see ScreenMotion history for why a rAF mirror
  // trailed by a frame). Two ride lists because cupertino / material animate
  // both the current and the previous screen per tick.
  const animateSwipe: typeof animateInline = (target, value, options) => {
    const result = animateInline(target, value, options);
    if (target === config.getElements().scope) {
      for (const bar of ridingBars.current) animateInline(bar, value, options);
    } else if (target === prevScreen) {
      for (const bar of ridingBars.prev) animateInline(bar, value, options);
    }
    return result;
  };

  const captureRidingBars = (prevScreenContainer: HTMLElement | null) => {
    const partnerBars = config.getPartnerBars();

    // Current side: this screen's own bars ride if the partner lacks a match.
    const current: HTMLElement[] = [];
    const { sharedAppBar, sharedNavigationBar } = config.getElements();
    if (sharedAppBar && config.hasSharedAppBar() && !partnerBars?.appBar)
      current.push(sharedAppBar);
    if (sharedNavigationBar && config.hasSharedNavigationBar() && !partnerBars?.navigationBar) {
      current.push(sharedNavigationBar);
    }

    // Prev side: the partner screen's bars (in its own subtree) ride if this
    // screen lacks a match. Queried directly so we don't reach into the
    // partner instance.
    const prev: HTMLElement[] = [];
    if (prevScreenContainer) {
      const prevAppBar = prevScreenContainer.querySelector<HTMLElement>('[data-flemo-bar="app"]');
      const prevNavBar = prevScreenContainer.querySelector<HTMLElement>('[data-flemo-bar="nav"]');
      if (prevAppBar && !config.hasSharedAppBar()) prev.push(prevAppBar);
      if (prevNavBar && !config.hasSharedNavigationBar()) prev.push(prevNavBar);
    }

    ridingBars = { current, prev };

    // Pre-promote the riding bars so the first inline write doesn't pay layer
    // creation.
    const willChange = collectAnimatedProperties(config.getTransition()).join(", ");
    for (const bar of current) bar.style.willChange = willChange;
    for (const bar of prev) bar.style.willChange = willChange;
  };

  const releaseRidingBars = () => {
    for (const bar of ridingBars.current) {
      clearInlineAnimation(bar);
      bar.style.removeProperty("will-change");
    }
    for (const bar of ridingBars.prev) {
      clearInlineAnimation(bar);
      bar.style.removeProperty("will-change");
    }
    ridingBars = { current: [], prev: [] };
  };

  const captureBarTransitions = (prevScreenContainer: HTMLElement | null) => {
    const { screenContainer } = config.getElements();
    // Reached only after beginSwipe's guards resolve the scope + prev screen, so
    // both containers are present.
    const select = (root: HTMLElement | null) =>
      Array.from(root!.querySelectorAll<HTMLElement>("[data-flemo-bar-transition-name]"));
    barTxEls = { current: select(screenContainer), prev: select(prevScreenContainer) };
  };

  // Drive each captured <BarTransition> element through its registered
  // bar-transition's swipe hook, passing whether it sits on the current
  // (active) or previous screen so the author can map the drag per side.
  const driveBarTransitions = (
    hook: "start" | "swipe" | "end",
    triggered: boolean,
    progress: number
  ) => {
    const run = (element: HTMLElement, active: boolean) => {
      // Selected by [data-flemo-bar-transition-name], so the attribute is present.
      const def = barTransitionMap.get(element.getAttribute("data-flemo-bar-transition-name")!);
      if (!def) return;
      const options = { animate: animateInline, element, active };
      if (hook === "swipe") def.onSwipe?.(triggered, progress, options);
      else if (hook === "start") def.onSwipeStart?.(triggered, options);
      else def.onSwipeEnd?.(triggered, options);
    };
    for (const element of barTxEls.current) run(element, true);
    for (const element of barTxEls.prev) run(element, false);
  };

  const releaseBarTransitions = () => {
    for (const element of [...barTxEls.current, ...barTxEls.prev]) clearInlineAnimation(element);
    barTxEls = { current: [], prev: [] };
  };

  const beginSwipe = async (event: PointerEvent) => {
    const transition = config.getTransition();
    if (!transition.swipeDirection || config.getViewportScrollHeight() > 10) return;

    const { scope, screenContainer, decorator } = config.getElements();
    if (!scope) return;

    const prevScreenContainer =
      (screenContainer?.parentElement?.previousElementSibling as HTMLElement | null) ?? null;
    prevScreen = prevScreenContainer?.querySelector<HTMLElement>("[data-flemo-screen]") ?? null;
    prevDecorator =
      prevScreenContainer?.querySelector<HTMLElement>("[data-flemo-decorator]") ?? null;

    if (!prevScreen) return;

    swipeActive = true;
    swipeStartPoint = { x: event.clientX, y: event.clientY };
    swipeLastPoint = { x: event.clientX, y: event.clientY };
    swipeLastTime = event.timeStamp;
    swipeVelocity = { x: 0, y: 0 };
    scope.setPointerCapture(event.pointerId);
    captureRidingBars(prevScreenContainer);
    captureBarTransitions(prevScreenContainer);

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
        driveBarTransitions("start", triggered, 0);
      }
    });

    if (isTriggered) {
      config.setDragStatus("PENDING");
    } else {
      config.setDragStatus("IDLE");
      swipeActive = false;
      releaseRidingBars();
    }
  };

  const continueSwipe = (event: PointerEvent) => {
    const transition = config.getTransition();
    if (!transition.swipeDirection || !swipeActive || config.getViewportScrollHeight() > 10) return;

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
        driveBarTransitions("swipe", triggered, progress);
      }
    });
  };

  const endSwipe = async (event: PointerEvent) => {
    const transition = config.getTransition();
    if (!transition.swipeDirection || !swipeActive) return;

    swipeActive = false;
    const { scope, decorator } = config.getElements();
    if (scope && scope.hasPointerCapture(event.pointerId)) {
      scope.releasePointerCapture(event.pointerId);
    }

    const decoratorDef = config.getDecorator();
    const isTriggered = await transition.onSwipeEnd(event, buildSwipeInfo(event), {
      animate: animateSwipe,
      currentScreen: scope as HTMLDivElement,
      prevScreen: prevScreen as HTMLDivElement,
      onStart: (triggered) => {
        decoratorDef?.onSwipeEnd?.(triggered, {
          animate: animateInline,
          currentDecorator: decorator as HTMLDivElement,
          prevDecorator: prevDecorator as HTMLDivElement
        });
        driveBarTransitions("end", triggered, 0);
      }
    });

    if (isTriggered) {
      // The swipe already animated the screen out. Suppress the upcoming
      // POPPING keyframe so it doesn't snap back to its `from` value first.
      scope?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      decorator?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      // Current-side bars unmount with the current screen via back(); just drop
      // will-change. Prev-side bars outlive the navigation, so strip the inline
      // transforms so they don't shadow the next compiled rule.
      for (const bar of ridingBars.current) bar.style.removeProperty("will-change");
      for (const bar of ridingBars.prev) {
        clearInlineAnimation(bar);
        bar.style.removeProperty("will-change");
      }
      ridingBars = { current: [], prev: [] };
      // Current-side bar-transition elements unmount with the screen; clear the
      // previous side's inline writes so they don't shadow the next rule.
      for (const element of barTxEls.prev) clearInlineAnimation(element);
      barTxEls = { current: [], prev: [] };
      config.back();
    } else {
      // Cancel: animation already played back to rest. Clear inline styles so
      // the CSS rest rule resumes ownership.
      if (scope) clearInlineAnimation(scope);
      if (prevScreen) clearInlineAnimation(prevScreen);
      if (decorator) clearInlineAnimation(decorator);
      if (prevDecorator) clearInlineAnimation(prevDecorator);
      releaseRidingBars();
      releaseBarTransitions();
      config.setDragStatus("IDLE");
    }
  };

  const pointerDown = (event: PointerEvent) => {
    if (!config.isReadyForDrag()) return;

    scrollableX = findScrollable(event.target, { direction: "x", verifyByScroll: true });
    scrollableY = findScrollable(event.target, { direction: "y", verifyByScroll: true });

    startX = event.clientX;
    startY = event.clientY;

    const hasNoScrollable = !scrollableX.element && !scrollableY.element;
    if (hasNoScrollable) {
      shouldStartDrag = true;
    } else if (!!scrollableX.element || !!scrollableY.element) {
      shouldStartDrag = true;
    }
  };

  const pointerMove = (event: PointerEvent) => {
    if (config.getViewportScrollHeight() > 10) return;

    if (swipeActive) {
      continueSwipe(event);
      return;
    }

    const swipeDirection = config.getTransition().swipeDirection;
    const hasNoScrollable = !scrollableX.element && !scrollableY.element;

    if (shouldStartDrag && hasNoScrollable) {
      shouldStartDrag = false;
      isTouchPrevented = true;

      const y = event.clientY - startY;
      const x = event.clientX - startX;

      if (swipeDirection === "y" && y > 0) {
        void beginSwipe(event);
      } else if (swipeDirection === "x" && x > 0) {
        void beginSwipe(event);
      }
    } else if (shouldStartDrag && !hasNoScrollable) {
      const x = event.clientX - startX;
      const y = event.clientY - startY;

      const isTopAtEdge = scrollableY.element && scrollableY.element.scrollTop <= 0;
      const isLeftAtEdge =
        scrollableX.element && scrollableX.element.scrollLeft <= 0 && scrollableX.hasMarker;

      if (
        swipeDirection === "y" &&
        (isTopAtEdge || !!scrollableX.element) &&
        y > 0 &&
        Math.abs(x) < 2
      ) {
        shouldStartDrag = false;
        isTouchPrevented = true;
        void beginSwipe(event);
      } else if (
        swipeDirection === "x" &&
        (isLeftAtEdge || !!scrollableY.element) &&
        x > 0 &&
        Math.abs(y) < 2
      ) {
        shouldStartDrag = false;
        isTouchPrevented = true;
        void beginSwipe(event);
      }
    }
  };

  const pointerUp = (event: PointerEvent) => {
    shouldStartDrag = false;
    isTouchPrevented = false;
    if (swipeActive) {
      void endSwipe(event);
    }
  };

  return {
    pointerDown,
    pointerMove,
    pointerUp,
    shouldPreventTouch: () => isTouchPrevented
  };
}

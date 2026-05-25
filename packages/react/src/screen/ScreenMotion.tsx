import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  animationName,
  collectAnimatedProperties,
  decoratorMap,
  findScrollable,
  TaskManger,
  transitionMap,
  useHistoryStore,
  useNavigateStore,
  variantHasAnimation,
  type SwipeInfo
} from "@flemo/core";

import type { ScreenProps } from "@screen/Screen";
import ScreenDecorator from "@screen/ScreenDecorator";

import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import useViewportScrollHeight from "@screen/useViewportScrollHeight";

import animateInline, { clearInlineAnimation } from "@transition/animateInline";

const useNavigationStore = useNavigateStore;

const SKIP_ANIMATION_ATTR = "data-flemo-skip-animation";

function ScreenMotion({
  children,
  statusBarHeight,
  statusBarColor,
  systemNavigationBarHeight,
  systemNavigationBarColor,
  sharedAppBar,
  sharedNavigationBar,
  appBar,
  navigationBar,
  hideStatusBar,
  hideSystemNavigationBar,
  backgroundColor = "white",
  contentScrollable = true,
  ...props
}: ScreenProps) {
  const { id, isActive, isRoot, zIndex, transitionName, prevTransitionName } = useScreen();

  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const setDragStatus = useScreenStore.getState().setDragStatus;
  const setReplaceTransitionStatus = useScreenStore.getState().setReplaceTransitionStatus;
  const index = useHistoryStore((state) => state.index);

  const currentTransition = (transitionMap.get(transitionName) ?? transitionMap.get("none"))!;
  const { initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const { viewportScrollHeight } = useViewportScrollHeight();

  const isKeyboardVisible = viewportScrollHeight > 0;

  const [sharedAppBarHeight, setSharedAppBarHeight] = useState(0);
  const [sharedNavigationBarHeight, setSharedNavigationBarHeight] = useState(0);

  const screenRef = useRef<HTMLDivElement | null>(null);
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const prevScreenRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const prevDecoratorRef = useRef<HTMLDivElement | null>(null);
  // Bars that should "ride along" during this swipe — split by which screen
  // they belong to. `current` are this screen's bars (mirrored when the
  // swipe handler writes to `currentScreen`); `prev` are the partner
  // screen's bars (mirrored when the handler writes to `prevScreen`, which
  // cupertino / material both do). Captured at beginSwipe and consumed by
  // the wrapped animate function, so bar inline writes happen in the same
  // JS tick as the screen write — no rAF mirror, no one-frame trailing lag.
  const swipeRidingBarsRef = useRef<{ current: HTMLDivElement[]; prev: HTMLDivElement[] }>({
    current: [],
    prev: []
  });
  const shouldStartDragRef = useRef(false);
  const isTouchPreventedRef = useRef(false);
  const swipeActiveRef = useRef(false);
  const swipeStartTimeRef = useRef(0);
  const swipeStartPointRef = useRef({ x: 0, y: 0 });
  const swipeLastPointRef = useRef({ x: 0, y: 0 });
  const swipeLastTimeRef = useRef(0);
  const swipeVelocityRef = useRef({ x: 0, y: 0 });
  const scrollableXRef = useRef<{
    element: HTMLElement | null;
    hasMarker: boolean;
  }>({
    element: null,
    hasMarker: false
  });
  const scrollableYRef = useRef<{
    element: HTMLElement | null;
    hasMarker: boolean;
  }>({ element: null, hasMarker: false });
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const sharedAppBarRef = useRef<HTMLDivElement | null>(null);
  const sharedNavigationBarRef = useRef<HTMLDivElement | null>(null);

  const buildSwipeInfo = (event: PointerEvent): SwipeInfo => {
    const last = swipeLastPointRef.current;
    return {
      point: { x: event.clientX, y: event.clientY },
      offset: {
        x: event.clientX - swipeStartPointRef.current.x,
        y: event.clientY - swipeStartPointRef.current.y
      },
      delta: { x: event.clientX - last.x, y: event.clientY - last.y },
      velocity: swipeVelocityRef.current
    };
  };

  const updateSwipeVelocity = (event: PointerEvent) => {
    const now = event.timeStamp;
    const dt = Math.max(1, now - swipeLastTimeRef.current);
    const last = swipeLastPointRef.current;
    swipeVelocityRef.current = {
      x: ((event.clientX - last.x) / dt) * 1000,
      y: ((event.clientY - last.y) / dt) * 1000
    };
    swipeLastPointRef.current = { x: event.clientX, y: event.clientY };
    swipeLastTimeRef.current = now;
  };

  // Wrap `animateInline` so any write to a screen is mirrored to the bars
  // that ride along with that screen — in the SAME synchronous tick. Without
  // this, the bars would need a rAF mirror loop that reads
  // `getComputedStyle(scope)` every frame — and rAF dispatches in its own JS
  // tick separate from the pointermove handler, so the bar always trailed
  // the screen by one frame (visible mostly on user-driven swipe drags).
  // Synchronous mirroring puts both elements in the same paint commit.
  //
  // Why two ride lists (current + prev): cupertino / material both call
  // `animate(currentScreen, ...)` AND `animate(prevScreen, ...)` per swipe
  // tick. If the previous screen has a bar that the current screen doesn't
  // (e.g., a tab bar on the home screen that a detail screen hides), that
  // bar must ride the previous screen as it slides back in. The previous
  // ScreenMotion instance is not the swipe-driver, so we cover it from here.
  const animateSwipe: typeof animateInline = (target, value, options) => {
    const result = animateInline(target, value, options);
    if (target === scopeRef.current) {
      for (const bar of swipeRidingBarsRef.current.current) {
        animateInline(bar, value, options);
      }
    } else if (target === prevScreenRef.current) {
      for (const bar of swipeRidingBarsRef.current.prev) {
        animateInline(bar, value, options);
      }
    }
    return result;
  };

  const captureRidingBars = (prevScreenContainer: HTMLDivElement | null) => {
    const partnerId = isActive
      ? useHistoryStore.getState().histories[index - 1]?.id
      : useHistoryStore.getState().histories[index]?.id;
    const partnerBars = partnerId ? useScreenStore.getState().sharedBars[partnerId] : undefined;

    // Current side: this screen's own bars, ride if the partner doesn't have
    // a matching bar.
    const current: HTMLDivElement[] = [];
    const appBarEl = sharedAppBarRef.current;
    const navBarEl = sharedNavigationBarRef.current;
    if (appBarEl && hasSharedAppBar && !partnerBars?.appBar) current.push(appBarEl);
    if (navBarEl && hasSharedNavigationBar && !partnerBars?.navigationBar) current.push(navBarEl);

    // Prev side: the partner screen's bars (rendered in its own subtree),
    // ride if this screen doesn't have a matching bar. We query the partner
    // container directly so we don't need to reach into the partner
    // ScreenMotion instance.
    const prev: HTMLDivElement[] = [];
    if (prevScreenContainer) {
      const prevAppBar =
        prevScreenContainer.querySelector<HTMLDivElement>('[data-flemo-bar="app"]');
      const prevNavBar =
        prevScreenContainer.querySelector<HTMLDivElement>('[data-flemo-bar="nav"]');
      if (prevAppBar && !hasSharedAppBar) prev.push(prevAppBar);
      if (prevNavBar && !hasSharedNavigationBar) prev.push(prevNavBar);
    }

    swipeRidingBarsRef.current = { current, prev };

    // Pre-promote the riding bars to their own compositing layer so the
    // browser doesn't have to do layer creation on the first inline write.
    const properties = collectAnimatedProperties(currentTransition);
    const willChange = properties.join(", ");
    for (const bar of current) bar.style.willChange = willChange;
    for (const bar of prev) bar.style.willChange = willChange;
  };

  const releaseRidingBars = () => {
    for (const bar of swipeRidingBarsRef.current.current) {
      clearInlineAnimation(bar);
      bar.style.removeProperty("will-change");
    }
    for (const bar of swipeRidingBarsRef.current.prev) {
      clearInlineAnimation(bar);
      bar.style.removeProperty("will-change");
    }
    swipeRidingBarsRef.current = { current: [], prev: [] };
  };

  const beginSwipe = async (event: PointerEvent) => {
    if (!swipeDirection || viewportScrollHeight > 10) return;

    const scope = scopeRef.current;
    if (!scope) return;

    const prevScreenContainer = screenRef.current?.parentElement
      ?.previousElementSibling as HTMLDivElement | null;
    prevScreenRef.current =
      prevScreenContainer?.querySelector<HTMLDivElement>("[data-flemo-screen]") ?? null;
    prevDecoratorRef.current =
      prevScreenContainer?.querySelector<HTMLDivElement>("[data-flemo-decorator]") ?? null;

    if (!prevScreenRef.current) return;

    swipeActiveRef.current = true;
    swipeStartTimeRef.current = event.timeStamp;
    swipeStartPointRef.current = { x: event.clientX, y: event.clientY };
    swipeLastPointRef.current = { x: event.clientX, y: event.clientY };
    swipeLastTimeRef.current = event.timeStamp;
    swipeVelocityRef.current = { x: 0, y: 0 };
    scope.setPointerCapture(event.pointerId);
    captureRidingBars(prevScreenContainer);

    const isTriggered = await currentTransition?.onSwipeStart(event, buildSwipeInfo(event), {
      animate: animateSwipe,
      currentScreen: scope,
      prevScreen: prevScreenRef.current!,
      onStart: (triggered) =>
        decorator?.onSwipeStart?.(triggered, {
          animate: animateInline,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });

    if (isTriggered) {
      setDragStatus("PENDING");
    } else {
      setDragStatus("IDLE");
      swipeActiveRef.current = false;
      releaseRidingBars();
    }
  };

  const continueSwipe = (event: PointerEvent) => {
    if (!swipeDirection || !swipeActiveRef.current || viewportScrollHeight > 10) return;

    updateSwipeVelocity(event);

    currentTransition.onSwipe(event, buildSwipeInfo(event), {
      animate: animateSwipe,
      currentScreen: scopeRef.current!,
      prevScreen: prevScreenRef.current!,
      onProgress: (triggered, progress) =>
        decorator?.onSwipe?.(triggered, progress, {
          animate: animateInline,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });
  };

  const endSwipe = async (event: PointerEvent) => {
    if (!swipeDirection || !swipeActiveRef.current) return;

    swipeActiveRef.current = false;
    const scope = scopeRef.current;
    if (scope && scope.hasPointerCapture(event.pointerId)) {
      scope.releasePointerCapture(event.pointerId);
    }

    const info = buildSwipeInfo(event);

    const isTriggered = await currentTransition?.onSwipeEnd(event, info, {
      animate: animateSwipe,
      currentScreen: scopeRef.current!,
      prevScreen: prevScreenRef.current!,
      onStart: (triggered) =>
        decorator?.onSwipeEnd?.(triggered, {
          animate: animateInline,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });

    if (isTriggered) {
      // The swipe already animated the screen all the way out. Mark the
      // element so the upcoming POPPING keyframe is suppressed — otherwise
      // the CSS animation would snap the screen back to its `from` value
      // before animating again.
      scopeRef.current?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      decoratorRef.current?.setAttribute(SKIP_ANIMATION_ATTR, "true");
      // Current-side bars unmount with the current screen via history.back()
      // — just drop will-change so the layer can be discarded.
      for (const bar of swipeRidingBarsRef.current.current) {
        bar.style.removeProperty("will-change");
      }
      // Prev-side bars belong to the screen that's becoming active and
      // outlive the navigation. Strip the inline transforms we wrote during
      // the swipe so they don't interfere with the next compiled rule (which
      // would otherwise be shadowed by inline styles at fill-mode-forwards
      // resting).
      for (const bar of swipeRidingBarsRef.current.prev) {
        clearInlineAnimation(bar);
        bar.style.removeProperty("will-change");
      }
      swipeRidingBarsRef.current = { current: [], prev: [] };
      window.history.back();
    } else {
      // Cancel: animation already played back to the rest position. Clear
      // inline styles so the CSS rest rule resumes ownership.
      clearInlineAnimation(scopeRef.current!);
      if (prevScreenRef.current) clearInlineAnimation(prevScreenRef.current);
      if (decoratorRef.current) clearInlineAnimation(decoratorRef.current);
      if (prevDecoratorRef.current) clearInlineAnimation(prevDecoratorRef.current);
      releaseRidingBars();
      setDragStatus("IDLE");
    }
  };

  const handlePointerDown = (event: ReactPointerEvent) => {
    const isReadyForDrag =
      !isRoot &&
      isActive &&
      status === "COMPLETED" &&
      dragStatus === "IDLE" &&
      !!swipeDirection &&
      viewportScrollHeight < 10;

    if (!isReadyForDrag) {
      return;
    }

    scrollableXRef.current = findScrollable(event.target, {
      direction: "x",
      verifyByScroll: true
    });
    scrollableYRef.current = findScrollable(event.target, {
      direction: "y",
      verifyByScroll: true
    });

    startXRef.current = event.clientX;
    startYRef.current = event.clientY;

    const hasNoScrollable = !scrollableXRef.current.element && !scrollableYRef.current.element;

    if (hasNoScrollable) {
      shouldStartDragRef.current = true;
    } else if (!!scrollableXRef.current.element || !!scrollableYRef.current.element) {
      shouldStartDragRef.current = true;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent) => {
    if (viewportScrollHeight > 10) {
      return;
    }

    if (swipeActiveRef.current) {
      continueSwipe(event.nativeEvent);
      return;
    }

    const hasNoScrollable = !scrollableXRef.current.element && !scrollableYRef.current.element;

    if (shouldStartDragRef.current && hasNoScrollable) {
      shouldStartDragRef.current = false;
      isTouchPreventedRef.current = true;

      const y = event.clientY - startYRef.current;
      const x = event.clientX - startXRef.current;

      if (swipeDirection === "y" && y > 0) {
        void beginSwipe(event.nativeEvent);
      } else if (swipeDirection === "x" && x > 0) {
        void beginSwipe(event.nativeEvent);
      }
    } else if (shouldStartDragRef.current && !hasNoScrollable) {
      const x = event.clientX - startXRef.current;
      const y = event.clientY - startYRef.current;

      const isTopAtEdge =
        scrollableYRef.current.element && scrollableYRef.current.element.scrollTop <= 0;
      const isLeftAtEdge =
        scrollableXRef.current.element &&
        scrollableXRef.current.element.scrollLeft <= 0 &&
        scrollableXRef.current.hasMarker;

      if (
        swipeDirection === "y" &&
        (isTopAtEdge || !!scrollableXRef.current.element) &&
        y > 0 &&
        Math.abs(x) < 2
      ) {
        shouldStartDragRef.current = false;
        isTouchPreventedRef.current = true;

        void beginSwipe(event.nativeEvent);
      } else if (
        swipeDirection === "x" &&
        (isLeftAtEdge || !!scrollableYRef.current.element) &&
        x > 0 &&
        Math.abs(y) < 2
      ) {
        shouldStartDragRef.current = false;
        isTouchPreventedRef.current = true;

        void beginSwipe(event.nativeEvent);
      }
    }
  };

  const handlePointerUp = (event: ReactPointerEvent) => {
    shouldStartDragRef.current = false;
    isTouchPreventedRef.current = false;
    if (swipeActiveRef.current) {
      void endSwipe(event.nativeEvent);
    }
  };

  useEffect(() => {
    const scope = scopeRef.current;

    if (!scope) return;

    const handleTouchMove = (event: TouchEvent) => {
      if (isTouchPreventedRef.current) {
        event.preventDefault();
      }

      if ((event.target as HTMLElement)?.dataset.swipeAtEdgeBar === "true") {
        event.preventDefault();
      }
    };

    scope.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });

    return () => {
      scope.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Drive transition lifecycle. The active screen resolves the current
  // navigation task once its animation settles (animationend on the primary
  // keyframe). For variants that compile to no animation we resolve on the
  // next microtask so the navigation queue still advances.
  useEffect(() => {
    if (!isActive) {
      const isTransitionDiffOnReplace = prevTransitionName !== transitionName;
      if (status === "REPLACING" && isTransitionDiffOnReplace) {
        setReplaceTransitionStatus("PENDING");
      }
      return;
    }

    if (status === "COMPLETED") {
      setDragStatus("IDLE");
      setReplaceTransitionStatus("IDLE");
      // Defensive cleanup. Inline `transform`/`opacity`/`transition` may have
      // been written by a swipe handler — onSwipe writes during drag, and
      // onSwipeEnd writes the cancel/commit animation. The swipe-cancel
      // branch clears them on resolve, but the swipe-commit branch and any
      // mid-flight navigation that interleaves can leave stale inline styles
      // on this scope. Because ScreenFreeze keeps the DOM mounted via
      // `display: none`, those styles outlive the original navigation and
      // resurface when this screen becomes active again — inline > compiled
      // CSS rest rule. Strip them now that we've settled as the active
      // screen so the next push/pop runs against a clean slate.
      //
      // Same applies to this screen's shared bars: the swipe-mirror writes
      // inline styles via `animateSwipe`, and if a release path is missed
      // (interleaved navigation, a partner whose ride-along path didn't
      // finalize, etc.) the bar would sit at the off-screen position even
      // after the owning screen settled as active. Clearing here also
      // re-bases bars to the compiled CSS rest rule.
      if (scopeRef.current) {
        clearInlineAnimation(scopeRef.current);
        scopeRef.current.removeAttribute(SKIP_ANIMATION_ATTR);
      }
      if (decoratorRef.current) {
        clearInlineAnimation(decoratorRef.current);
        decoratorRef.current.removeAttribute(SKIP_ANIMATION_ATTR);
      }
      if (sharedAppBarRef.current) {
        clearInlineAnimation(sharedAppBarRef.current);
        sharedAppBarRef.current.style.removeProperty("will-change");
      }
      if (sharedNavigationBarRef.current) {
        clearInlineAnimation(sharedNavigationBarRef.current);
        sharedNavigationBarRef.current.style.removeProperty("will-change");
      }
      return;
    }

    if (status === "IDLE") return;

    const scope = scopeRef.current;
    if (!scope) return;

    const resolve = () => {
      const transitionTaskId = useNavigationStore.getState().transitionTaskId;
      if (transitionTaskId) {
        void TaskManger.resolveTask(transitionTaskId);
      }
    };

    const variantKey = `${status}-true` as const;
    const skipAnimation = scope.getAttribute(SKIP_ANIMATION_ATTR) === "true";
    const hasAnimation = !skipAnimation && variantHasAnimation(currentTransition, variantKey);

    if (!hasAnimation) {
      // No CSS animation will fire — resolve in a microtask so React commits
      // first and the queue keeps advancing.
      queueMicrotask(resolve);
      return;
    }

    const expectedName = animationName("screen", transitionName, variantKey);
    const onEnd = (event: AnimationEvent) => {
      if (event.target !== scope) return;
      if (event.animationName !== expectedName) return;
      scope.removeEventListener("animationend", onEnd);
      resolve();
    };

    scope.addEventListener("animationend", onEnd);
    return () => {
      scope.removeEventListener("animationend", onEnd);
    };
  }, [
    status,
    isActive,
    id,
    prevTransitionName,
    transitionName,
    currentTransition,
    setDragStatus,
    setReplaceTransitionStatus
  ]);

  useLayoutEffect(() => {
    const element = sharedAppBarRef.current;
    if (!element) {
      setSharedAppBarHeight(0);
      return;
    }
    setSharedAppBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      setSharedAppBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sharedAppBar]);

  useLayoutEffect(() => {
    const element = sharedNavigationBarRef.current;
    if (!element) {
      setSharedNavigationBarHeight(0);
      return;
    }
    setSharedNavigationBarHeight(element.offsetHeight);
    const observer = new ResizeObserver(([entry]) => {
      setSharedNavigationBarHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [sharedNavigationBar]);

  // Register this screen's shared-bar presence so other screens can read it.
  useLayoutEffect(() => {
    const { registerSharedBars, unregisterSharedBars } = useScreenStore.getState();
    registerSharedBars(id, {
      appBar: !!sharedAppBar,
      navigationBar: !!sharedNavigationBar
    });
    return () => unregisterSharedBars(id);
  }, [id, sharedAppBar, sharedNavigationBar]);

  // Shared bars render outside the animated scope (siblings inside screenRef),
  // so any transition the scope runs has no inherent effect on the bar. When
  // the partner screen owns the same bar, this is exactly what we want: the
  // bar appears to hand over seamlessly while screens animate underneath.
  // When the partner does NOT own the bar, the bar must ride along.
  //
  // Two paths handle ride-along:
  //
  // 1. CSS-driven transitions (push / pop / replace). The compiled rule emits
  //    a sibling selector that targets `[data-flemo-bar][...riding="true"]`
  //    with the same `@keyframes` the screen uses. We set the bar's data-
  //    attributes here and toggle `data-flemo-bar-riding` based on partner
  //    ownership. The compositor drives both elements off one keyframe — no
  //    JS frame in the loop, no main-thread style read/write per frame.
  // 2. Swipe drag. Handled synchronously inside the swipe lifecycle via
  //    `animateSwipe` (see beginSwipe / continueSwipe / endSwipe above),
  //    which mirrors every `animate(currentScreen, ...)` call to the riding
  //    bars in the SAME JS tick. No rAF loop, no `getComputedStyle` reads —
  //    the bars and the screen commit in the same paint pass.
  const isTopOrTopPrev = isActive || zIndex === index - 1;
  const hasSharedAppBar = !!sharedAppBar;
  const hasSharedNavigationBar = !!sharedNavigationBar;

  // (1) Toggle `data-flemo-bar-riding` on each bar based on partner ownership.
  // `useLayoutEffect` so the attribute is set before the browser paints the
  // first frame of the transition. We re-evaluate on store changes too,
  // because a partner Screen may register its shared bars slightly after this
  // screen reads them (commit-order races).
  useLayoutEffect(() => {
    const appBarEl = sharedAppBarRef.current;
    const navBarEl = sharedNavigationBarRef.current;
    if (!appBarEl && !navBarEl) return;

    const apply = () => {
      const transitioningNow =
        useNavigationStore.getState().status === "PUSHING" ||
        useNavigationStore.getState().status === "POPPING" ||
        useNavigationStore.getState().status === "REPLACING";
      if (!transitioningNow || !isTopOrTopPrev) {
        appBarEl?.removeAttribute("data-flemo-bar-riding");
        navBarEl?.removeAttribute("data-flemo-bar-riding");
        return;
      }
      const partnerId = isActive
        ? useHistoryStore.getState().histories[index - 1]?.id
        : useHistoryStore.getState().histories[index]?.id;
      const partnerBars = partnerId ? useScreenStore.getState().sharedBars[partnerId] : undefined;
      const rideApp = hasSharedAppBar && !partnerBars?.appBar;
      const rideNav = hasSharedNavigationBar && !partnerBars?.navigationBar;
      if (appBarEl) appBarEl.setAttribute("data-flemo-bar-riding", rideApp ? "true" : "false");
      if (navBarEl) navBarEl.setAttribute("data-flemo-bar-riding", rideNav ? "true" : "false");
    };

    apply();
    const unsubScreen = useScreenStore.subscribe(apply);
    const unsubNavigation = useNavigationStore.subscribe(apply);
    return () => {
      unsubScreen();
      unsubNavigation();
      appBarEl?.removeAttribute("data-flemo-bar-riding");
      navBarEl?.removeAttribute("data-flemo-bar-riding");
    };
  }, [isTopOrTopPrev, isActive, index, hasSharedAppBar, hasSharedNavigationBar]);

  const initialStyle: { transform?: string; opacity?: string } = (() => {
    // Only the actively entering screen needs the initial style; everything
    // else either has a CSS rest rule applying (IDLE/COMPLETED) or is in the
    // middle of an animation whose keyframe `from` block already enforces the
    // entry value.
    if (!isActive) return {};
    if (status !== "PUSHING" && status !== "REPLACING") return {};
    const initialDecls: { transform?: string; opacity?: string } = {};
    if (typeof initial.x === "number") initialDecls.transform = `translateX(${initial.x}px)`;
    if (typeof initial.x === "string") initialDecls.transform = `translateX(${initial.x})`;
    if (typeof initial.y === "number") initialDecls.transform = `translateY(${initial.y}px)`;
    if (typeof initial.y === "string") initialDecls.transform = `translateY(${initial.y})`;
    if (typeof initial.opacity === "number") initialDecls.opacity = `${initial.opacity}`;
    return initialDecls;
  })();

  return (
    <div
      ref={screenRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        // `contain: layout style` keeps layout/style scoped without `paint`,
        // which would make this element the containing block for `position:
        // fixed` descendants and trap consumer overlays (e.g. bottom sheets)
        // inside the screen.
        contain: "layout style",
        flexDirection: "column",
        boxSizing: "border-box",
        overscrollBehavior: "contain"
      }}
    >
      <div
        data-swipe-at-edge-bar
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
      <div
        ref={scopeRef}
        {...props}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        data-flemo-screen
        data-flemo-transition={transitionName}
        data-flemo-status={status}
        data-flemo-active={isActive ? "true" : "false"}
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor,
          overflowY: contentScrollable ? undefined : "auto",
          touchAction: swipeDirection === "x" ? "pan-y" : swipeDirection === "y" ? "pan-x" : "auto",
          ...initialStyle,
          ...props.style
        }}
      >
        {!hideStatusBar && statusBarHeight && (
          <div style={{ minHeight: statusBarHeight }}>
            <div
              style={{
                position: "fixed",
                top: 0,
                width: "100%",
                minHeight: statusBarHeight,
                backgroundColor: statusBarColor
              }}
            />
          </div>
        )}
        {sharedAppBar && (
          <div
            style={{
              width: "100%",
              minHeight: sharedAppBarHeight
            }}
          />
        )}
        {appBar}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            overflowY: contentScrollable ? "auto" : undefined
          }}
        >
          {children}
        </div>
        {navigationBar}
        {sharedNavigationBar && (
          <div
            style={{
              display: isKeyboardVisible ? "none" : undefined,
              width: "100%",
              minHeight: sharedNavigationBarHeight
            }}
          />
        )}
        {!hideSystemNavigationBar && systemNavigationBarHeight && (
          <div
            style={{
              display: isKeyboardVisible ? "none" : undefined,
              minHeight: systemNavigationBarHeight
            }}
          >
            <div
              style={{
                position: "fixed",
                bottom: 0,
                width: "100%",
                minHeight: systemNavigationBarHeight,
                backgroundColor: systemNavigationBarColor
              }}
            />
          </div>
        )}
      </div>
      {sharedAppBar && (
        <div
          ref={sharedAppBarRef}
          data-flemo-bar="app"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          style={{
            position: "fixed",
            top: !hideStatusBar ? statusBarHeight : 0,
            left: 0,
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedAppBar}
        </div>
      )}
      {sharedNavigationBar && (
        <div
          ref={sharedNavigationBarRef}
          data-flemo-bar="nav"
          data-flemo-bar-transition={transitionName}
          data-flemo-bar-status={status}
          data-flemo-bar-active={isActive ? "true" : "false"}
          style={{
            display: isKeyboardVisible ? "none" : undefined,
            position: "fixed",
            bottom: !hideSystemNavigationBar ? systemNavigationBarHeight : 0,
            left: 0,
            width: "100%",
            zIndex: 1
          }}
        >
          {sharedNavigationBar}
        </div>
      )}
      {decorator && <ScreenDecorator ref={decoratorRef} />}
      <div
        data-swipe-at-edge-bar
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
    </div>
  );
}

export default ScreenMotion;

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";

import {
  animationName,
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
  const sharedBars = useScreenStore((state) => state.sharedBars);
  const setDragStatus = useScreenStore.getState().setDragStatus;
  const setReplaceTransitionStatus = useScreenStore.getState().setReplaceTransitionStatus;
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

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

    const isTriggered = await currentTransition?.onSwipeStart(event, buildSwipeInfo(event), {
      animate: animateInline,
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
    }
  };

  const continueSwipe = (event: PointerEvent) => {
    if (!swipeDirection || !swipeActiveRef.current || viewportScrollHeight > 10) return;

    updateSwipeVelocity(event);

    currentTransition.onSwipe(event, buildSwipeInfo(event), {
      animate: animateInline,
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
      animate: animateInline,
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
      window.history.back();
    } else {
      // Cancel: animation already played back to the rest position. Clear
      // inline styles so the CSS rest rule resumes ownership.
      clearInlineAnimation(scopeRef.current!);
      if (prevScreenRef.current) clearInlineAnimation(prevScreenRef.current);
      if (decoratorRef.current) clearInlineAnimation(decoratorRef.current);
      if (prevDecoratorRef.current) clearInlineAnimation(prevDecoratorRef.current);
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

  // Shared bars stay pinned via position:fixed during transitions between
  // screens that share the same bar. When the partner screen lacks the bar
  // this screen owns, the bar rides along by mirroring the scope's computed
  // transform/opacity per frame. Raw requestAnimationFrame keeps the loop
  // independent of motion's scheduler.
  const isTransitioning =
    status === "PUSHING" ||
    status === "POPPING" ||
    status === "REPLACING" ||
    dragStatus === "PENDING";
  const isTopOrTopPrev = isActive || zIndex === index - 1;
  const partnerScreenId = isActive ? histories[index - 1]?.id : histories[index]?.id;
  const partnerSharedBars = partnerScreenId ? sharedBars[partnerScreenId] : undefined;
  const shouldRideSharedAppBar =
    isTransitioning && isTopOrTopPrev && !!sharedAppBar && !partnerSharedBars?.appBar;
  const shouldRideSharedNavigationBar =
    isTransitioning && isTopOrTopPrev && !!sharedNavigationBar && !partnerSharedBars?.navigationBar;

  useEffect(() => {
    const scope = scopeRef.current;
    const appBarEl = sharedAppBarRef.current;
    const navBarEl = sharedNavigationBarRef.current;

    if (appBarEl && !shouldRideSharedAppBar) {
      appBarEl.style.transform = "";
      appBarEl.style.opacity = "";
    }
    if (navBarEl && !shouldRideSharedNavigationBar) {
      navBarEl.style.transform = "";
      navBarEl.style.opacity = "";
    }

    const ridingEls = [
      shouldRideSharedAppBar ? appBarEl : null,
      shouldRideSharedNavigationBar ? navBarEl : null
    ].filter((el): el is HTMLDivElement => el !== null);

    if (!scope || ridingEls.length === 0) return;

    let rafId = 0;
    const sync = () => {
      const { transform, opacity } = getComputedStyle(scope);
      for (const el of ridingEls) {
        el.style.transform = transform;
        el.style.opacity = opacity;
      }
      rafId = requestAnimationFrame(sync);
    };
    sync();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [shouldRideSharedAppBar, shouldRideSharedNavigationBar]);

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
        contain: "strict",
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

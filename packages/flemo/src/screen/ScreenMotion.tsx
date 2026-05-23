import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from "react";

import {
  cancelFrame,
  frame,
  motion,
  useAnimate,
  useDragControls,
  type PanInfo
} from "motion/react";

import TaskManger from "@core/TaskManger";

import useHistoryStore from "@history/store";

import useNavigationStore from "@navigate/store";

import type { ScreenProps } from "@screen/Screen";
import ScreenDecorator from "@screen/ScreenDecorator";

import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import useViewportScrollHeight from "@screen/useViewportScrollHeight";

import { transitionMap, transitionInitialValue } from "@transition/transition";

import findScrollable from "@utils/findScrollable";

import { decoratorMap } from "@transition/decorator/decorator";

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
  const [scope, animate] = useAnimate();

  const { id, isActive, isRoot, zIndex, transitionName, prevTransitionName } = useScreen();
  const dragControls = useDragControls();

  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const sharedBars = useScreenStore((state) => state.sharedBars);
  const setDragStatus = useScreenStore.getState().setDragStatus;
  const setReplaceTransitionStatus = useScreenStore.getState().setReplaceTransitionStatus;
  const index = useHistoryStore((state) => state.index);
  const histories = useHistoryStore((state) => state.histories);

  const currentTransition = (transitionMap.get(transitionName) ?? transitionMap.get("none"))!;
  const { variants, initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const { viewportScrollHeight } = useViewportScrollHeight();

  const isKeyboardVisible = viewportScrollHeight > 0;

  const [sharedAppBarHeight, setSharedAppBarHeight] = useState(0);
  const [sharedNavigationBarHeight, setSharedNavigationBarHeight] = useState(0);

  const screenRef = useRef<HTMLDivElement | null>(null);
  const prevScreenRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const prevDecoratorRef = useRef<HTMLDivElement | null>(null);
  const shouldStartDragRef = useRef(false);
  const isTouchPreventedRef = useRef(false);
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

  const handleDragStart = async (
    event: MouseEvent | TouchEvent | globalThis.PointerEvent,
    info: PanInfo
  ) => {
    if (!swipeDirection || viewportScrollHeight > 10) {
      return;
    }

    const prevScreen = screenRef.current?.parentElement?.previousElementSibling as HTMLDivElement;
    prevScreenRef.current = prevScreen?.querySelector("[data-screen]");
    prevDecoratorRef.current = prevScreen?.querySelector("[data-decorator]");

    const isTriggered = await currentTransition?.onSwipeStart(event, info, {
      animate,
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!,
      dragControls,
      onStart: (triggered) =>
        decorator?.onSwipeStart?.(triggered, {
          animate,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });

    if (isTriggered) {
      setDragStatus("PENDING");
    } else {
      setDragStatus("IDLE");
    }
  };

  const handleDrag = (event: MouseEvent | TouchEvent | globalThis.PointerEvent, info: PanInfo) => {
    if (!swipeDirection || dragStatus !== "PENDING" || viewportScrollHeight > 10) {
      return;
    }

    currentTransition.onSwipe(event, info, {
      animate,
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!,
      dragControls,
      onProgress: (triggered, progress) =>
        decorator?.onSwipe?.(triggered, progress, {
          animate,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });
  };

  const handleDragEnd = async (
    event: MouseEvent | TouchEvent | globalThis.PointerEvent,
    info: PanInfo
  ) => {
    if (!swipeDirection || dragStatus !== "PENDING" || viewportScrollHeight > 10) {
      return;
    }

    const isTriggered = await currentTransition?.onSwipeEnd(event, info, {
      animate,
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!,
      onStart: (triggered) =>
        decorator?.onSwipeEnd?.(triggered, {
          animate,
          currentDecorator: decoratorRef.current!,
          prevDecorator: prevDecoratorRef.current!
        })
    });

    if (isTriggered) {
      window.history.back();
    } else {
      setDragStatus("IDLE");
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
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

  const handlePointerMove = (event: PointerEvent) => {
    if (viewportScrollHeight > 10) {
      return;
    }

    const hasNoScrollable = !scrollableXRef.current.element && !scrollableYRef.current.element;

    if (shouldStartDragRef.current && hasNoScrollable) {
      shouldStartDragRef.current = false;
      isTouchPreventedRef.current = true;

      const y = event.clientY - startYRef.current;
      const x = event.clientX - startXRef.current;

      if (swipeDirection === "y" && y > 0) {
        dragControls.start(event);
      } else if (swipeDirection === "x" && x > 0) {
        dragControls.start(event);
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

        dragControls.start(event);
      } else if (
        swipeDirection === "x" &&
        (isLeftAtEdge || !!scrollableYRef.current.element) &&
        x > 0 &&
        Math.abs(y) < 2
      ) {
        shouldStartDragRef.current = false;
        isTouchPreventedRef.current = true;

        dragControls.start(event);
      }
    }
  };

  const handlePointerUp = () => {
    shouldStartDragRef.current = false;
    isTouchPreventedRef.current = false;
  };

  useEffect(() => {
    const currentScreen = scope.current;

    if (!currentScreen) return;

    const handleTouchMove = (event: TouchEvent) => {
      if (isTouchPreventedRef.current) {
        event.preventDefault();
      }

      if ((event.target as HTMLElement)?.dataset.swipeAtEdgeBar === "true") {
        event.preventDefault();
      }
    };

    currentScreen.addEventListener("touchmove", handleTouchMove, {
      passive: false
    });

    return () => {
      currentScreen.removeEventListener("touchmove", handleTouchMove);
    };
  }, [scope]);

  useEffect(() => {
    if (!scope.current) return;

    (async () => {
      const { value, options } = variants[`${status}-${isActive}`];

      const isTransitionDiffOnReplace = prevTransitionName !== transitionName;

      if (!isActive && status === "REPLACING" && isTransitionDiffOnReplace) {
        setReplaceTransitionStatus("PENDING");
        await animate(scope.current, transitionInitialValue, {
          duration: 0.1
        });
      }

      if (isActive && status === "COMPLETED") {
        setDragStatus("IDLE");
        setReplaceTransitionStatus("IDLE");
      }

      await animate(scope.current, value, options);

      // The active screen is the genuine animation participant for every
      // transition (push/replace/pop), so it resolves the current navigation
      // task once its animation settles.
      if (isActive) {
        const transitionTaskId = useNavigationStore.getState().transitionTaskId;

        if (transitionTaskId) {
          await TaskManger.resolveTask(transitionTaskId);
        }
      }
    })();
  }, [
    status,
    isActive,
    id,
    prevTransitionName,
    transitionName,
    animate,
    scope,
    variants,
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

  // Shared bars are always rendered outside motion.div as position:fixed so
  // they stay pinned during transitions between screens that share the same
  // bar. When transitioning to/from a screen that lacks a bar this screen
  // has, the bar must ride along with this screen's transform/opacity. We
  // achieve that by mirroring the scope motion.div's computed transform and
  // opacity onto the bar's DOM each frame for the duration of the transition —
  // no mode switch, no layout shift.
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
    const scopeEl = scope.current;
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

    if (!scopeEl || ridingEls.length === 0) return;

    const sync = () => {
      const { transform, opacity } = getComputedStyle(scopeEl);
      for (const el of ridingEls) {
        el.style.transform = transform;
        el.style.opacity = opacity;
      }
    };

    sync();
    frame.postRender(sync, true);

    return () => {
      cancelFrame(sync);
    };
  }, [scope, shouldRideSharedAppBar, shouldRideSharedNavigationBar]);

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
      <motion.div
        ref={scope}
        {...props}
        initial={initial}
        drag={swipeDirection}
        dragListener={false}
        dragControls={dragControls}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-screen
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor,
          overflowY: contentScrollable ? undefined : "auto",
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
      </motion.div>
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

import { useEffect, useRef, type PropsWithChildren, type PointerEvent } from "react";

import {
  motion,
  useAnimate,
  useDragControls,
  type PanInfo,
  type HTMLMotionProps
} from "motion/react";

import TaskManger from "@core/TaskManger";

import findScrollable from "@utils/findScrollable";

import useNavigationStore from "@navigate/store";

import ScreenDecorator from "@screen/ScreenDecorator";
import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import { decoratorMap } from "@transition/decorator/decorator";
import { transitionMap, transitionInitialValue } from "@transition/transition";

function ScreenMotion({
  children,
  ...props
}: PropsWithChildren<
  Omit<
    HTMLMotionProps<"div">,
    | "initial"
    | "drag"
    | "dragControls"
    | "dragListener"
    | "onDragStart"
    | "onDrag"
    | "onDragEnd"
    | "onPointerDown"
    | "onPointerMove"
    | "onPointerUp"
  >
>) {
  const [scope, animate] = useAnimate();

  const { id, isActive, isRoot, transitionName, prevTransitionName } = useScreen();
  const dragControls = useDragControls();

  const status = useNavigationStore((state) => state.status);
  const dragStatus = useScreenStore((state) => state.dragStatus);
  const setDragStatus = useScreenStore.getState().setDragStatus;
  const setReplaceTransitionStatus = useScreenStore.getState().setReplaceTransitionStatus;

  const currentTransition = transitionMap.get(transitionName)!;
  const { variants, initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

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

  const handleDragStart = async (
    event: MouseEvent | TouchEvent | globalThis.PointerEvent,
    info: PanInfo
  ) => {
    if (!swipeDirection) {
      return;
    }

    prevScreenRef.current = scope.current?.previousSibling as HTMLDivElement;
    prevDecoratorRef.current = scope.current?.previousSibling?.querySelector("[data-decorator]");

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
    if (!swipeDirection || dragStatus !== "PENDING") {
      return;
    }

    currentTransition?.onSwipe(event, info, {
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
    if (!swipeDirection || dragStatus !== "PENDING") {
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
      !isRoot && isActive && status === "COMPLETED" && dragStatus === "IDLE" && !!swipeDirection;

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
    const hasNoScrollable = !scrollableXRef.current.element && !scrollableYRef.current.element;

    if (shouldStartDragRef.current && hasNoScrollable) {
      shouldStartDragRef.current = false;
      isTouchPreventedRef.current = true;
      dragControls.start(event);
    } else if (shouldStartDragRef.current && !hasNoScrollable) {
      const x = event.clientX - startXRef.current;
      const y = event.clientY - startYRef.current;

      const isTopAtEdge =
        scrollableYRef.current.element &&
        scrollableYRef.current.element.scrollTop <= 0 &&
        scrollableYRef.current.hasMarker;
      const isLeftAtEdge =
        scrollableXRef.current.element &&
        scrollableXRef.current.element.scrollLeft <= 0 &&
        scrollableXRef.current.hasMarker;

      if (
        swipeDirection === "y" &&
        (isTopAtEdge || !!scrollableXRef.current.element) &&
        y > 0 &&
        Math.abs(x) < 4
      ) {
        shouldStartDragRef.current = false;
        isTouchPreventedRef.current = true;
        dragControls.start(event);
      } else if (
        swipeDirection === "x" &&
        (isLeftAtEdge || !!scrollableYRef.current.element) &&
        x > 0 &&
        Math.abs(y) < 4
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

      await TaskManger.resolveTask(id);
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

  return (
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
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        boxSizing: "border-box",
        touchAction: "none",
        isolation: "isolate",
        contain: "strict",
        overscrollBehavior: "contain",
        ...props.style
      }}
    >
      <div
        data-swipe-at-edge-bar
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%"
        }}
      >
        {children}
      </div>
      {decorator && <ScreenDecorator ref={decoratorRef} />}
      <div
        data-swipe-at-edge-bar
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 8,
          height: "100%",
          zIndex: 1
        }}
      />
    </motion.div>
  );
}

export default ScreenMotion;

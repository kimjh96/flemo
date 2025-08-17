import { useEffect, useRef, type ComponentPropsWithRef } from "react";

import { motion, useAnimate, useDragControls, type PanInfo } from "motion/react";

import TaskManger from "@core/TaskManger";

import useNavigationStore from "@navigate/store";

import ScreenMotionDecorator from "@screen/ScreenMotionDecorator";
import useScreenStore from "@screen/store";
import useScreen from "@screen/useScreen";

import { decoratorMap } from "@transition/decorator/decorator";
import { transitionMap, transitionInitialValue } from "@transition/transition";

function ScreenMotion({ children, ...props }: ComponentPropsWithRef<"div">) {
  const [scope, animate] = useAnimate();

  const { id, isActive, isRoot, transitionName, prevTransitionName } = useScreen();
  const dragControls = useDragControls();

  const status = useNavigationStore((state) => state.status);
  const transitionStatus = useScreenStore((state) => state.transitionStatus);
  const setTransitionStatus = useScreenStore.getState().setTransitionStatus;

  const currentTransition = transitionMap.get(transitionName)!;
  const { variants, initial, swipeDirection, decoratorName } = currentTransition;
  const decorator = decoratorMap.get(decoratorName!);

  const prevScreenRef = useRef<HTMLDivElement | null>(null);
  const decoratorRef = useRef<HTMLDivElement | null>(null);
  const prevDecoratorRef = useRef<HTMLDivElement | null>(null);

  const handleDragStart = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!swipeDirection) {
      return;
    }

    prevScreenRef.current = scope.current?.previousSibling as HTMLDivElement;
    prevDecoratorRef.current =
      scope.current?.previousSibling?.querySelector("& > [data-decorator]");

    currentTransition?.onSwipeStart(event, info, {
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!,
      dragControls
    });

    setTransitionStatus("PENDING");
  };

  const handleDrag = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!swipeDirection || transitionStatus !== "PENDING") {
      return;
    }

    const progress = currentTransition?.onSwipe(event, info, {
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!,
      dragControls
    });

    decorator?.onSwipe?.(progress, {
      currentDecorator: decoratorRef.current!,
      prevDecorator: prevDecoratorRef.current!
    });
  };

  const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!swipeDirection || transitionStatus !== "PENDING") {
      return;
    }

    const isTriggered = await currentTransition?.onSwipeEnd(event, info, {
      currentScreen: scope.current!,
      prevScreen: prevScreenRef.current!
    });

    if (isTriggered) {
      window.history.back();
    } else {
      setTransitionStatus("IDLE");
    }
  };

  useEffect(() => {
    const currentScreen = scope.current;

    if (!currentScreen) return;

    const handleTouchMove = (event: TouchEvent) => event.preventDefault();

    currentScreen.addEventListener("touchmove", handleTouchMove);

    return () => {
      currentScreen.removeEventListener("touchmove", handleTouchMove);
    };
  }, [scope]);

  useEffect(() => {
    if (!scope.current) return;

    (async () => {
      const { value, options } = variants[`${status}-${isActive}`];

      const isTransitionDiffOnReplace =
        status === "REPLACING" && prevTransitionName !== transitionName;

      if (!isActive && isTransitionDiffOnReplace) {
        setTransitionStatus("PENDING");
        await animate(scope.current, transitionInitialValue, {
          duration: 0.01
        });
      }

      await animate(scope.current, value, options);

      await TaskManger.resolveTask(id);

      if (!isActive && !isTransitionDiffOnReplace) {
        setTransitionStatus("IDLE");
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
    setTransitionStatus,
    variants
  ]);

  return (
    <motion.div
      ref={scope}
      initial={initial}
      drag={swipeDirection}
      dragListener={!isRoot && isActive && status === "COMPLETED" && transitionStatus === "IDLE"}
      dragControls={dragControls}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "white",
        ...props.style
      }}
    >
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
      {decorator && <ScreenMotionDecorator ref={decoratorRef} />}
    </motion.div>
  );
}

export default ScreenMotion;

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { fullVariants } from "./variantStub";

// THE GESTURE, REPORTED TO WHOEVER ELSE RIDES IT.
//
// A shared element cannot be driven from a transition's swipe handlers — it is
// not the author's element — so the controller reports the drag itself and the
// binding hands it to the morph runtime. What this pins down is that the report
// does not depend on anything the AUTHOR chose to do.
//
// It was wired to the handler's `onStart` callback first, and every built-in
// transition returns `true` from `onSwipeStart` without ever calling it: the
// screens followed the finger and the shared element never moved. So the start
// is the controller's own confirmation, and the progress is taken from whichever
// way the handler offers it — the callback, or its return value.

function buildDom() {
  const root = document.createElement("div");
  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");
  prevScreenContainer.appendChild(prevScope);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "");
  screenContainer.appendChild(scope);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, screenContainer };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("createSwipeController drag hooks", () => {
  let dom: ReturnType<typeof buildDom>;
  let onDragStart: Mock<() => void>;
  let onDragProgress: Mock<(progress: number) => void>;
  let onDragSettle: Mock<(committed: boolean, seconds: number) => void>;

  // A transition written the way EVERY built-in is: it returns `true` and never
  // calls a single one of the callbacks it is handed.
  const silentHandlers = (progressFromReturn: boolean) => ({
    onSwipeStart: vi.fn(async () => true),
    onSwipe: vi.fn(() => (progressFromReturn ? 42 : undefined)),
    onSwipeEnd: vi.fn(async () => true)
  });

  const buildConfig = (handlers: ReturnType<typeof silentHandlers>): SwipeControllerConfig => ({
    getTransition: () =>
      ({
        name: "drag-hooks-test",
        initial: { x: "100%" },
        variants: fullVariants({ x: 0 }, { duration: 0.3 }),
        swipeDirection: "x",
        ...handlers
      }) as unknown as Transition,
    getDecorator: () => undefined,
    getElements: () => ({
      scope: dom.scope,
      screenContainer: dom.screenContainer,
      decorator: null,
      sharedTopBar: null,
      sharedBottomBar: null
    }),
    hasSharedTopBar: () => false,
    hasSharedBottomBar: () => false,
    getViewportScrollHeight: () => 0,
    isReadyForDrag: () => true,
    getPartnerBars: () => undefined,
    setDragStatus: vi.fn(),
    back: vi.fn(),
    onDragStart,
    onDragProgress,
    onDragSettle
  });

  beforeEach(() => {
    dom = buildDom();
    onDragStart = vi.fn<() => void>();
    onDragProgress = vi.fn<(progress: number) => void>();
    onDragSettle = vi.fn<(committed: boolean, seconds: number) => void>();
  });

  afterEach(() => {
    dom.root.remove();
  });

  it("reports the start even though the transition never calls onStart", async () => {
    const controller = createSwipeController(buildConfig(silentHandlers(false)));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("reports the drag against the SCREEN's span, not the handler's own number", async () => {
    // A transition's progress means whatever its author decided: cupertino
    // divides the drag by `window.innerWidth`. Inside a contained Router that
    // is a different denominator entirely — a full drag across a 378px stage
    // in a 1500px window reads as 8% — so anything driven by it barely moves
    // and the release rushes the rest. The span that matters is the screen
    // being dragged.
    dom.scope.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 400,
        height: 800,
        right: 400,
        bottom: 800,
        toJSON: () => ({})
      }) as DOMRect;

    const controller = createSwipeController(buildConfig(silentHandlers(true)));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    for (const clientX of [40, 80, 120, 160]) {
      controller.pointerMove(event({ clientX, clientY: 100 }));
      await flush();
    }

    expect(onDragProgress).toHaveBeenCalled();
    // Measured from where the DRAG began, not from the finger's first contact:
    // the recognizer's slop is not travel. 160 minus the 40 that armed it, over
    // the screen's own 400 — not the handler's 42, and not a fraction of the
    // window.
    expect(onDragProgress.mock.calls.at(-1)?.[0]).toBeCloseTo(0.3, 2);
  });

  it("falls back to the viewport when the screen has no box to measure", async () => {
    // A scope that has not laid out (or an exotic embedder with no rect) still
    // has to report a progress between 0 and 1, and the window is the only
    // other span there is.
    dom.scope.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({})
      }) as DOMRect;

    const controller = createSwipeController(buildConfig(silentHandlers(true)));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    for (const clientX of [40, 80]) {
      controller.pointerMove(event({ clientX, clientY: 100 }));
      await flush();
    }

    expect(onDragProgress).toHaveBeenCalled();
    expect(onDragProgress.mock.calls.at(-1)?.[0]).toBeCloseTo(40 / window.innerWidth, 5);
  });

  it("measures a vertical drag against the screen's height", async () => {
    // The axis is the transition's, not the gesture's: a sheet that dismisses
    // downwards divides by the height it is travelling through.
    dom.scope.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 400,
        height: 800,
        right: 400,
        bottom: 800,
        toJSON: () => ({})
      }) as DOMRect;

    const handlers = silentHandlers(true);
    const config = buildConfig(handlers);
    const vertical: SwipeControllerConfig = {
      ...config,
      getTransition: () =>
        ({
          ...(config.getTransition() as unknown as Record<string, unknown>),
          swipeDirection: "y"
        }) as unknown as ReturnType<typeof config.getTransition>
    };

    const controller = createSwipeController(vertical);
    controller.pointerDown(event({ target: dom.scope, clientX: 100, clientY: 0 }));
    for (const clientY of [40, 200]) {
      controller.pointerMove(event({ clientX: 100, clientY }));
      await flush();
    }

    // 200 minus the 40 that armed the drag, over the screen's own 800.
    expect(onDragProgress.mock.calls.at(-1)?.[0]).toBeCloseTo(0.2, 2);
  });

  it("falls back to the viewport's HEIGHT for a vertical drag", async () => {
    dom.scope.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        toJSON: () => ({})
      }) as DOMRect;

    const config = buildConfig(silentHandlers(true));
    const vertical: SwipeControllerConfig = {
      ...config,
      getTransition: () =>
        ({
          ...(config.getTransition() as unknown as Record<string, unknown>),
          swipeDirection: "y"
        }) as unknown as ReturnType<typeof config.getTransition>
    };

    const controller = createSwipeController(vertical);
    controller.pointerDown(event({ target: dom.scope, clientX: 100, clientY: 0 }));
    for (const clientY of [40, 90]) {
      controller.pointerMove(event({ clientX: 100, clientY }));
      await flush();
    }

    expect(onDragProgress.mock.calls.at(-1)?.[0]).toBeCloseTo(50 / window.innerHeight, 5);
  });

  it("reports the release before the handler's own settle resolves", async () => {
    // A handler awaits its screen animations — every built-in does — and
    // anything reported after that await is a passenger frozen for the whole
    // settle: the shared element stops dead under the finger, waits out the
    // screen, and only then moves. The report belongs at the verdict.
    let releaseHandlerResolved = false;
    let reportedWhileHandlerRan = false;
    const handlers = {
      onSwipeStart: vi.fn(async () => true),
      onSwipe: vi.fn(() => 42),
      onSwipeEnd: vi.fn(
        async (
          _e: unknown,
          _i: unknown,
          ctx: {
            onStart?: (t: boolean) => void;
            animate: (...args: unknown[]) => unknown;
            currentScreen: HTMLElement;
          }
        ) => {
          ctx.onStart?.(true);
          // The screens' own settle: a real duration, awaited.
          // The SCREEN's own settle: the target matters, because the release
          // scales each participant's clock separately and what rides the
          // gesture from outside must be given the screens' one.
          ctx.animate(ctx.currentScreen, {}, { duration: 0.3 });
          await new Promise((resolve) => setTimeout(resolve, 30));
          releaseHandlerResolved = true;
          return true;
        }
      )
    } as unknown as ReturnType<typeof silentHandlers>;

    onDragSettle = vi.fn<(committed: boolean, seconds: number) => void>(() => {
      reportedWhileHandlerRan = !releaseHandlerResolved;
    });

    const controller = createSwipeController(buildConfig(handlers));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    for (const clientX of [40, 80, 120, 160]) {
      controller.pointerMove(event({ clientX, clientY: 100 }));
      await flush();
    }
    controller.pointerUp(event({ clientX: 200, clientY: 100 }));
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(onDragSettle).toHaveBeenCalledTimes(1);
    expect(reportedWhileHandlerRan).toBe(true);
  });

  it("reports the SCREENS' settle clock, not the first participant's", async () => {
    // Every participant of a release gets its own scaled clock — each names
    // its own ceiling — and the decorator's is written FIRST and is shorter.
    // A shared element handed that clock finishes before the screen carrying
    // the slot it is flying to, and jumps the difference as it lands: measured
    // at 21.8px on a swipe-back.
    let screenSeconds: number | null = null;
    const handlers = {
      onSwipeStart: vi.fn(async () => true),
      onSwipe: vi.fn(() => 42),
      onSwipeEnd: vi.fn(
        async (
          _e: unknown,
          _i: unknown,
          ctx: {
            onStart?: (t: boolean) => void;
            animate: (...args: unknown[]) => unknown;
            currentScreen: HTMLElement;
          }
        ) => {
          // The decorator's write comes first and is authored shorter.
          ctx.onStart?.(true);
          ctx.animate(document.createElement("div"), {}, { duration: 0.1 });
          // Then the screen's, authored longer.
          ctx.animate(ctx.currentScreen, {}, { duration: 0.6 });
          screenSeconds = 0.6;
          return true;
        }
      )
    } as unknown as ReturnType<typeof silentHandlers>;

    const controller = createSwipeController(buildConfig(handlers));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    for (const clientX of [40, 80, 120, 160]) {
      controller.pointerMove(event({ clientX, clientY: 100 }));
      await flush();
    }
    controller.pointerUp(event({ clientX: 200, clientY: 100 }));
    await flush();

    expect(onDragSettle).toHaveBeenCalledTimes(1);
    const reported = onDragSettle.mock.calls[0]![1];
    // Scaled from the SCREEN's 0.6 ceiling, not the decorator's 0.1.
    expect(screenSeconds).toBe(0.6);
    expect(reported).toBeGreaterThan(0.1);
  });

  it("reports the release with the same seconds the screens settle in", async () => {
    const controller = createSwipeController(buildConfig(silentHandlers(true)));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    controller.pointerUp(event({ clientX: 200, clientY: 100 }));
    await flush();

    expect(onDragSettle).toHaveBeenCalledTimes(1);
    const [committed, seconds] = onDragSettle.mock.calls[0]!;
    expect(committed).toBe(true);
    expect(typeof seconds).toBe("number");
    expect(seconds).toBeGreaterThanOrEqual(0);
  });
});

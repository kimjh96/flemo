import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { fullVariants } from "./variantStub";

// Gesture-path branches: scrollable-aware drag starts (edge detection), the
// y-direction begin, the keyboard guard, and pointer-up resets.

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

  return { root, scope, screenContainer, prevScope };
}

// A vertically scrollable child inside the scope: 200px of content in a 100px
// box. jsdom has no layout, so the extents are defined directly.
function scrollableChild(scope: HTMLElement) {
  const scrollable = document.createElement("div");
  scrollable.style.overflowY = "auto";
  Object.defineProperty(scrollable, "scrollHeight", { configurable: true, value: 200 });
  Object.defineProperty(scrollable, "clientHeight", { configurable: true, value: 100 });
  Object.defineProperty(scrollable, "scrollWidth", { configurable: true, value: 100 });
  Object.defineProperty(scrollable, "clientWidth", { configurable: true, value: 100 });
  scope.appendChild(scrollable);
  return scrollable;
}

function horizontalScrollableChild(scope: HTMLElement, marked = false) {
  const scrollable = document.createElement("div");
  scrollable.style.overflowX = "auto";
  if (marked) scrollable.setAttribute("data-swipe-at-edge", "");
  Object.defineProperty(scrollable, "scrollHeight", { configurable: true, value: 100 });
  Object.defineProperty(scrollable, "clientHeight", { configurable: true, value: 100 });
  Object.defineProperty(scrollable, "scrollWidth", { configurable: true, value: 200 });
  Object.defineProperty(scrollable, "clientWidth", { configurable: true, value: 100 });
  scope.appendChild(scrollable);
  return scrollable;
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

// The drag's follow write lands on an ANIMATION FRAME — one write per frame,
// not one per pointermove (see createSwipeController's queueFollow) — so a
// flush has to let a frame run before the assertions read the DOM.
const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("createSwipeController gesture paths", () => {
  let dom: ReturnType<typeof buildDom>;
  let onSwipeStart: ReturnType<typeof vi.fn>;
  let config: SwipeControllerConfig;

  const buildConfig = (direction: "x" | "y"): SwipeControllerConfig => {
    onSwipeStart = vi.fn(async () => true);
    return {
      getTransition: () =>
        ({
          name: "swipe-gesture-test",
          initial: { x: "100%" },
          variants: fullVariants({ x: 0 }, { duration: 0.3 }),
          swipe: {
            direction: direction,
            onStart: onSwipeStart,
            onMove: vi.fn(() => 0),
            onEnd: vi.fn(async () => false)
          }
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
      back: vi.fn()
    };
  };

  beforeEach(() => {
    dom = buildDom();
  });

  afterEach(() => {
    dom.root.remove();
  });

  it("begins a y-direction swipe on a downward drag", async () => {
    config = buildConfig("y");
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientY: 40 }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalled();
  });

  it("keeps a vertical scroll native instead of mistaking its x jitter for swipe-back", async () => {
    config = buildConfig("x");
    const c = createSwipeController(config);

    c.pointerDown(event({ target: dom.scope, clientX: 100, clientY: 100 }));
    c.pointerMove(event({ clientX: 102, clientY: 132 }));
    c.pointerMove(event({ clientX: 118, clientY: 170 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("waits past touch slop before claiming a direction", async () => {
    config = buildConfig("x");
    const c = createSwipeController(config);

    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 5, clientY: 1 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);

    c.pointerMove(event({ clientX: 12, clientY: 2 }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalledTimes(1);
    expect(c.shouldPreventTouch()).toBe(true);
  });

  it("ignores moves while the keyboard is open (viewport shortfall)", async () => {
    config = buildConfig("x");
    config.getViewportScrollHeight = () => 100;
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it("begins a y-swipe from inside a scrollable only when it sits at its top edge", async () => {
    config = buildConfig("y");
    const scrollable = scrollableChild(dom.scope);
    scrollable.scrollTop = 0;

    const c = createSwipeController(config);
    c.pointerDown(event({ target: scrollable }));
    c.pointerMove(event({ clientY: 30, clientX: 0 }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalled();
  });

  it("does NOT begin a y-swipe when the scrollable is mid-scroll", async () => {
    config = buildConfig("y");
    const scrollable = scrollableChild(dom.scope);
    scrollable.scrollTop = 50;

    const c = createSwipeController(config);
    c.pointerDown(event({ target: scrollable }));
    c.pointerMove(event({ clientY: 30, clientX: 0 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it("does NOT begin when the drag has too much cross-axis travel", async () => {
    config = buildConfig("y");
    const scrollable = scrollableChild(dom.scope);
    scrollable.scrollTop = 0;

    const c = createSwipeController(config);
    c.pointerDown(event({ target: scrollable }));
    c.pointerMove(event({ clientY: 30, clientX: 10 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it("begins an x-swipe inside a vertical scroller when horizontal intent wins", async () => {
    config = buildConfig("x");
    const scrollable = scrollableChild(dom.scope);

    const c = createSwipeController(config);
    c.pointerDown(event({ target: scrollable }));
    c.pointerMove(event({ clientX: 40, clientY: 2 }));
    await flush();

    expect(onSwipeStart).toHaveBeenCalledTimes(1);
  });

  it("begins an x-swipe at a marked horizontal scroller's left edge only", async () => {
    config = buildConfig("x");
    const scrollable = horizontalScrollableChild(dom.scope, true);
    const c = createSwipeController(config);

    scrollable.scrollLeft = 0;
    c.pointerDown(event({ target: scrollable }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalledTimes(1);

    c.pointerUp(event({ clientX: 40 }));
    await flush();
    onSwipeStart.mockClear();
    scrollable.scrollLeft = 20;
    c.pointerDown(event({ target: scrollable, pointerId: 2 }));
    c.pointerMove(event({ clientX: 40, pointerId: 2 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
  });

  it("pointer-up without an active swipe just resets the gesture", async () => {
    config = buildConfig("x");
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerUp(event({}));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("ignores foreign pointer endings and cancels an unresolved candidate safely", async () => {
    config = buildConfig("x");
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope, pointerId: 1 }));

    c.pointerUp(event({ pointerId: 2 }));
    c.pointerCancel(event({ pointerId: 2 }));
    c.pointerCancel(event({ pointerId: 1 }));
    c.pointerMove(event({ clientX: 40, pointerId: 1 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("never commits a cancelled pointer stream", async () => {
    config = buildConfig("x");
    const onEnd = vi.fn(async (..._args: unknown[]) => true);
    const back = vi.fn();
    const transition = config.getTransition();
    config.getTransition = () =>
      ({ ...transition, swipe: { ...transition.swipe, onEnd } }) as Transition;
    config.back = back;
    const c = createSwipeController(config);

    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    c.pointerCancel(event({ clientX: 160 }));
    await flush();

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        offset: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 }
      })
    );
    expect(back).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });
});

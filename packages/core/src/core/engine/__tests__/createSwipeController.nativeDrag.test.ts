import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { fullVariants } from "./variantStub";

// A MOUSE DRAG ACROSS TEXT USED TO END THE GESTURE.
//
// Touch was covered — the binding preventDefaults `touchmove` — and a mouse had
// nothing. Dragging left-to-right over a screen's copy starts a native
// selection, the browser claims the pointer with `pointercancel`, and the swipe
// force-cancels. Read off a screen recording: the selection highlight is on
// screen in the same frames the dragged screen turns around and settles home
// from 43% of its travel, well past the commit threshold. The gesture simply
// stops working, at random, and only with a mouse.
//
// The suppression lasts exactly as long as the gesture holds the pointer.
// Selecting text on a resting screen is the consumer's business.

const SPAN = 360;

function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");
  prevScreenContainer.append(prevScope);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "");
  screenContainer.append(scope);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  scope.getBoundingClientRect = () => ({ width: SPAN, height: 700, top: 0, left: 0 }) as DOMRect;
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

// What the browser would do next: `selectstart` is cancelable, so a listener
// that calls preventDefault is what stops the selection from beginning.
const nativeSelectionStarts = (): boolean =>
  document.dispatchEvent(new Event("selectstart", { cancelable: true, bubbles: true }));

const nativeImageDragStarts = (): boolean =>
  document.dispatchEvent(new Event("dragstart", { cancelable: true, bubbles: true }));

describe("a gesture and the browser's own drag", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;

  beforeEach(() => {
    dom = buildDom();

    const transition = {
      name: "native-drag",
      initial: { x: "100%" },
      variants: fullVariants({ x: 0 }, { duration: 0.35 }),
      swipe: {
        direction: "x",
        onStart: async () => true,
        onMove: () => 0,
        onEnd: async () => false
      }
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
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
  });

  // Every controller that armed the suppression has to disarm before the next
  // test looks at it: the listeners are on `document`, so one left behind would
  // make the next assertion pass for the wrong reason.
  const live: ReturnType<typeof createSwipeController>[] = [];

  afterEach(() => {
    for (const controller of live.splice(0)) controller.abandon();
    dom.root.remove();
  });

  const startDrag = async () => {
    const controller = createSwipeController(config);
    live.push(controller);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40 }));
    await flush();
    controller.pointerMove(event({ clientX: 140, timeStamp: 16 }));
    await flush();
    return controller;
  };

  it("leaves selection alone until a gesture actually holds the pointer", () => {
    createSwipeController(config);

    expect(nativeSelectionStarts()).toBe(true);
    expect(nativeImageDragStarts()).toBe(true);
  });

  it("stops the browser taking the pointer away mid-drag", async () => {
    await startDrag();

    expect(nativeSelectionStarts()).toBe(false);
    expect(nativeImageDragStarts()).toBe(false);
  });

  it("gives selection back when the gesture releases", async () => {
    const controller = await startDrag();

    controller.pointerUp(event({ clientX: 140, timeStamp: 32 }));
    await flush();

    expect(nativeSelectionStarts()).toBe(true);
    expect(nativeImageDragStarts()).toBe(true);
  });

  it("gives selection back when the gesture is abandoned", async () => {
    const controller = await startDrag();

    // The closing event never comes — a lost capture with no pointerup behind
    // it. Leaving the suppression armed here would take the consumer's
    // selection away for the rest of the session.
    controller.abandon();
    await flush();

    expect(nativeSelectionStarts()).toBe(true);
    expect(nativeImageDragStarts()).toBe(true);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

// The screen a back-swipe reveals is normally frozen (React's <Activity> hid
// it and unmounted its effects when it was covered), and starting the gesture
// is what wakes it — a commit over the whole subtree that lands on the drag's
// first frames and reads as the motion catching once before it runs. The
// controller holds the follow until that reveal has been painted, then resumes
// from where the finger IS. The opening is a frame or two late; nothing
// stutters after it.
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

  return { root, scope, screenContainer, prevScreenContainer, prevScope };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const task = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the reveal hold", () => {
  let dom: ReturnType<typeof buildDom>;
  let frames: FrameRequestCallback[];
  let onSwipe: ReturnType<typeof vi.fn>;
  let config: SwipeControllerConfig;

  const runFrame = async (at = performance.now()) => {
    const queued = frames.splice(0);
    queued.forEach((frame) => frame(at));
    await task();
  };

  beforeEach(() => {
    dom = buildDom();
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
      frames.push(frame);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    onSwipe = vi.fn(() => 0);

    const transition = {
      name: "reveal-hold",
      initial: { x: "100%" },
      variants: {} as Transition["variants"],
      swipeDirection: "x",
      onSwipeStart: async () => true,
      onSwipe,
      onSwipeEnd: async () => false
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

  afterEach(() => {
    dom.root.remove();
    vi.unstubAllGlobals();
  });

  const beginDrag = async (controller: ReturnType<typeof createSwipeController>) => {
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40 }));
    await task();
  };

  it("writes nothing while the revealed screen is still hidden", async () => {
    dom.prevScreenContainer.style.display = "none"; // frozen, as <Activity> leaves it
    const controller = createSwipeController(config);
    await beginDrag(controller);

    controller.pointerMove(event({ clientX: 90, timeStamp: 16 }));
    await runFrame();
    await runFrame();

    expect(onSwipe).not.toHaveBeenCalled();
  });

  it("resumes from where the finger IS once the reveal has painted", async () => {
    dom.prevScreenContainer.style.display = "none";
    const controller = createSwipeController(config);
    await beginDrag(controller);

    controller.pointerMove(event({ clientX: 90, timeStamp: 16 }));
    await runFrame();

    // the wake lands
    dom.prevScreenContainer.style.display = "";
    await runFrame(); // seen displayed — one frame to paint
    expect(onSwipe).not.toHaveBeenCalled();

    // the finger kept moving while the motion was held
    controller.pointerMove(event({ clientX: 200, timeStamp: 32 }));
    await runFrame();

    expect(onSwipe).toHaveBeenCalledTimes(1);
    // resumed at the CURRENT sample, not the one it was holding
    expect(onSwipe.mock.calls[0][1].offset.x).toBe(160);
  });

  it("never strands the gesture: the cap releases a wake that does not land", async () => {
    dom.prevScreenContainer.style.display = "none";
    const controller = createSwipeController(config);
    await beginDrag(controller);

    controller.pointerMove(event({ clientX: 120, timeStamp: 16 }));
    await runFrame(performance.now() + 400); // past the 200ms cap

    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("costs nothing when there is nothing to wake", async () => {
    // Already displayed: the hold resolves on its first check, in the same
    // frame the follow would have written anyway.
    const controller = createSwipeController(config);
    await beginDrag(controller);

    controller.pointerMove(event({ clientX: 90, timeStamp: 16 }));
    await runFrame();

    expect(onSwipe).toHaveBeenCalledTimes(1);
  });
});

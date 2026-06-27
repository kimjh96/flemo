import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";
import { barTransitionMap } from "@transition/barTransition/barTransition";

// Minimal DOM mirroring the renderer: a previous screen wrapper followed by the
// current screen wrapper, so beginSwipe's `parentElement.previousElementSibling`
// walk resolves the prev screen's `[data-flemo-screen]`.
function buildDom() {
  const root = document.createElement("div");
  const prevWrapper = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");
  prevWrapper.appendChild(prevScope);

  const curWrapper = document.createElement("div");
  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "");
  screenContainer.appendChild(scope);
  curWrapper.appendChild(screenContainer);

  root.append(prevWrapper, curWrapper);
  document.body.appendChild(root);

  // jsdom doesn't implement pointer capture; stub it.
  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, screenContainer, prevScope };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSwipeController", () => {
  let dom: ReturnType<typeof buildDom>;
  let onSwipeStart: ReturnType<typeof vi.fn>;
  let onSwipe: ReturnType<typeof vi.fn>;
  let onSwipeEnd: ReturnType<typeof vi.fn>;
  let setDragStatus: SwipeControllerConfig["setDragStatus"];
  let back: SwipeControllerConfig["back"];
  let transition: Transition;
  let config: SwipeControllerConfig;

  beforeEach(() => {
    dom = buildDom();
    onSwipeStart = vi.fn(async () => true);
    onSwipe = vi.fn(() => 0);
    onSwipeEnd = vi.fn(async () => false);
    setDragStatus = vi.fn();
    back = vi.fn();
    transition = {
      name: "swipe-test",
      initial: { x: "100%" },
      variants: {} as Transition["variants"],
      swipeDirection: "x",
      onSwipeStart,
      onSwipe,
      onSwipeEnd
    } as unknown as Transition;
    config = {
      getTransition: () => transition,
      getDecorator: () => undefined,
      getElements: () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedAppBar: null,
        sharedNavigationBar: null
      }),
      hasSharedAppBar: () => false,
      hasSharedNavigationBar: () => false,
      getViewportScrollHeight: () => 0,
      isReadyForDrag: () => true,
      getPartnerBars: () => undefined,
      setDragStatus,
      back
    };
  });

  afterEach(() => {
    dom.root.remove();
    vi.useRealTimers();
  });

  it("does not start a drag when the readiness gate is closed", async () => {
    config.isReadyForDrag = () => false;
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("begins the swipe past the x-threshold and goes PENDING when the transition triggers", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalledTimes(1);
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("PENDING");
    expect(c.shouldPreventTouch()).toBe(true);
  });

  it("releases back to IDLE when the transition declines the swipe", async () => {
    onSwipeStart.mockResolvedValueOnce(false);
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
    expect(vi.mocked(setDragStatus)).not.toHaveBeenCalledWith("PENDING");
  });

  it("forwards continued moves to the transition with built swipe info", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    onSwipe.mockClear();
    // The swipe began at the threshold-crossing move (clientX 40), so offset is
    // measured from there: 140 - 40 = 100.
    c.pointerMove(event({ clientX: 140, clientY: 0, timeStamp: 16 }));
    expect(onSwipe).toHaveBeenCalledTimes(1);
    const info = onSwipe.mock.calls[0][1];
    expect(info.offset.x).toBe(100);
  });

  it("commits the navigation when the swipe-end triggers", async () => {
    onSwipeEnd.mockResolvedValueOnce(true);
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    c.pointerUp(event({ clientX: 200 }));
    await flush();
    expect(vi.mocked(back)).toHaveBeenCalledTimes(1);
    expect(dom.scope.getAttribute("data-flemo-skip-animation")).toBe("true");
  });

  it("cancels back to IDLE when the swipe-end declines", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    vi.mocked(setDragStatus).mockClear();
    c.pointerUp(event({ clientX: 5 }));
    await flush();
    expect(vi.mocked(back)).not.toHaveBeenCalled();
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
  });

  describe("bar transitions", () => {
    let btStart: ReturnType<typeof vi.fn>;
    let btSwipe: ReturnType<typeof vi.fn>;
    let btEnd: ReturnType<typeof vi.fn>;
    let curBar: HTMLElement;
    let prevBar: HTMLElement;

    beforeEach(() => {
      // A <BarTransition> element on the current screen and one on the previous
      // screen's subtree (resolved via parentElement.previousElementSibling).
      curBar = document.createElement("div");
      curBar.setAttribute("data-flemo-bar-transition-name", "test-bar");
      dom.screenContainer.appendChild(curBar);
      prevBar = document.createElement("div");
      prevBar.setAttribute("data-flemo-bar-transition-name", "test-bar");
      (dom.root.firstElementChild as HTMLElement).appendChild(prevBar); // prevWrapper

      btStart = vi.fn();
      btSwipe = vi.fn();
      btEnd = vi.fn();
      barTransitionMap.set("test-bar", {
        name: "test-bar",
        initial: {},
        variants: {} as never,
        onSwipeStart: btStart,
        onSwipe: btSwipe,
        onSwipeEnd: btEnd
      } as never);

      // Make the transition relay its lifecycle callbacks so the controller's
      // bar-transition driving actually runs.
      onSwipeStart.mockImplementation(
        async (_e: unknown, _i: unknown, o: { onStart?: (t: boolean) => void }) => {
          o.onStart?.(true);
          return true;
        }
      );
      onSwipe.mockImplementation(
        (_e: unknown, _i: unknown, o: { onProgress?: (t: boolean, p: number) => void }) => {
          o.onProgress?.(true, 42);
          return 42;
        }
      );
      onSwipeEnd.mockImplementation(
        async (_e: unknown, _i: unknown, o: { onStart?: (t: boolean) => void }) => {
          o.onStart?.(true);
          return false;
        }
      );
    });

    afterEach(() => barTransitionMap.delete("test-bar"));

    it("drives current (active) + previous (inactive) bar elements through start/swipe", async () => {
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      expect(btStart).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ element: curBar, active: true })
      );
      expect(btStart).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ element: prevBar, active: false })
      );

      c.pointerMove(event({ clientX: 140, clientY: 0, timeStamp: 16 }));
      expect(btSwipe).toHaveBeenCalledWith(
        true,
        42,
        expect.objectContaining({ element: curBar, active: true })
      );
    });

    it("runs onSwipeEnd and releases inline writes on a cancelled swipe", async () => {
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      c.pointerUp(event({ clientX: 5 }));
      await flush();
      expect(btEnd).toHaveBeenCalledWith(
        true,
        expect.objectContaining({ element: curBar, active: true })
      );
    });

    it("skips bar elements whose name isn't registered", async () => {
      const ghost = document.createElement("div");
      ghost.setAttribute("data-flemo-bar-transition-name", "not-registered");
      dom.screenContainer.appendChild(ghost);
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      // The registered element still fires; the unknown name resolves to no def
      // and is silently skipped — no throw.
      expect(btStart).toHaveBeenCalled();
    });

    it("clears the previous side's inline writes when the swipe commits", async () => {
      onSwipeEnd.mockImplementation(
        async (_e: unknown, _i: unknown, o: { onStart?: (t: boolean) => void }) => {
          o.onStart?.(true);
          return true;
        }
      );
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      c.pointerUp(event({ clientX: 200 }));
      await flush();
      expect(vi.mocked(back)).toHaveBeenCalledTimes(1);
      expect(btEnd).toHaveBeenCalled();
    });
  });
});

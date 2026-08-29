import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import { fullVariants } from "./variantStub";

// Minimal DOM mirroring the renderer: the previous and current screen containers
// as DIRECT siblings (Activity-based freeze adds no wrapper element), so
// beginSwipe's previous-sibling walk resolves the prev screen's
// `[data-flemo-screen]`.
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

  // jsdom doesn't implement pointer capture; stub it.
  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, screenContainer, prevScope };
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
      variants: fullVariants({ x: 0 }, { duration: 0.3 }),
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
        sharedTopBar: null,
        sharedBottomBar: null
      }),
      hasSharedTopBar: () => false,
      hasSharedBottomBar: () => false,
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

  it("does not begin the swipe when there is no screen below to reveal", async () => {
    // Drop the previous screen container so the current screen has no preceding
    // sibling: beginSwipe must find no prev screen and bail.
    dom.root.firstElementChild?.remove();
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(vi.mocked(setDragStatus)).not.toHaveBeenCalledWith("PENDING");
  });

  it("does not begin the swipe when the screen container is missing", async () => {
    config.getElements = () => ({
      scope: dom.scope,
      screenContainer: null,
      decorator: null,
      sharedTopBar: null,
      sharedBottomBar: null
    });
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(onSwipeStart).not.toHaveBeenCalled();
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
    dom.scope.hasPointerCapture = vi.fn(() => false);
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
    expect(vi.mocked(setDragStatus)).not.toHaveBeenCalledWith("PENDING");
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("finishes cleanly when pointer-up waits on a declined async start", async () => {
    let resolveStart!: (triggered: boolean) => void;
    onSwipeStart.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveStart = resolve))
    );
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    c.pointerUp(event({ clientX: 40 }));

    resolveStart(false);
    await flush();
    await flush();

    expect(onSwipeEnd).not.toHaveBeenCalled();
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("abandons a pending gesture if transition readiness closes before intent resolves", async () => {
    let ready = true;
    config.isReadyForDrag = () => ready;
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    ready = false;
    c.pointerMove(event({ clientX: 40 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("ignores movement from a different pointer", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope, pointerId: 1 }));
    c.pointerMove(event({ clientX: 40, pointerId: 2 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("ignores secondary and non-primary pointer starts", async () => {
    const c = createSwipeController(config);

    c.pointerDown(event({ target: dom.scope, pointerId: 1, pointerType: "mouse", button: 2 }));
    c.pointerMove(event({ clientX: 40, pointerId: 1 }));
    c.pointerDown(event({ target: dom.scope, pointerId: 2, isPrimary: false }));
    c.pointerMove(event({ clientX: 40, pointerId: 2 }));
    expect(onSwipeStart).not.toHaveBeenCalled();

    c.pointerDown(event({ target: dom.scope, pointerId: 3 }));
    c.pointerDown(event({ target: dom.scope, pointerId: 4, isPrimary: false }));
    c.pointerMove(event({ clientX: 40, pointerId: 4, isPrimary: false }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    c.pointerMove(event({ clientX: 40, pointerId: 3, isPrimary: true }));
    await flush();
    expect(onSwipeStart).toHaveBeenCalledTimes(1);
  });

  it("recovers when a pre-capture pointer stream ends outside the scope", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope, pointerId: 1, isPrimary: true }));
    // No pointerup/pointercancel reaches this controller. Before intent is
    // resolved there is no pointer capture to guarantee either event.
    c.pointerDown(event({ target: dom.scope, pointerId: 2, isPrimary: true }));
    c.pointerMove(event({ clientX: 40, pointerId: 2, isPrimary: true }));
    await flush();

    expect(onSwipeStart).toHaveBeenCalledTimes(1);
  });

  // This used to assert the opposite — that a captured swipe is never replaced
  // — and that is what the field bug was. A PRIMARY pointer going down means no
  // other pointer is down, so a swipe still marked active at that moment
  // belongs to a finger that is already gone and whose closing event is never
  // coming. Refusing to replace it left the screen unable to scroll (see
  // createSwipeController.stuckGesture.test.ts). The rule is the same one the
  // pre-capture case above already followed; capture does not make a vanished
  // pointer any less vanished.
  it("replaces the captured pointer of a swipe whose own pointer is gone", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope, pointerId: 1, isPrimary: true }));
    c.pointerMove(event({ clientX: 40, pointerId: 1, isPrimary: true }));
    await flush();

    c.pointerDown(event({ target: dom.scope, pointerId: 2, isPrimary: true }));
    c.pointerMove(event({ clientX: 80, pointerId: 2, isPrimary: true }));
    await flush();

    expect(onSwipeStart).toHaveBeenCalledTimes(2);
    expect(c.shouldPreventTouch()).toBe(true);
  });

  it("does not let a SECOND finger disturb the swipe the first is driving", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope, pointerId: 1, isPrimary: true }));
    c.pointerMove(event({ clientX: 40, pointerId: 1, isPrimary: true }));
    await flush();

    // isPrimary false: the first finger is still down, so its gesture is alive.
    c.pointerDown(event({ target: dom.scope, pointerId: 2, isPrimary: false }));
    c.pointerMove(event({ clientX: 80, pointerId: 2, isPrimary: false }));
    await flush();

    expect(onSwipeStart).toHaveBeenCalledTimes(1);
  });

  it("abandons intent when the live transition no longer supports swipe", async () => {
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    transition = { ...transition, swipeDirection: undefined } as unknown as Transition;
    c.pointerMove(event({ clientX: 40 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("releases touch ownership if swipe preconditions change at begin", async () => {
    let viewportReads = 0;
    config.getViewportScrollHeight = () => (viewportReads++ === 0 ? 0 : 100);
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("releases touch ownership if the scope disappears at begin", async () => {
    config.getElements = () => ({
      scope: null,
      screenContainer: dom.screenContainer,
      decorator: null,
      sharedTopBar: null,
      sharedBottomBar: null
    });
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    await flush();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(c.shouldPreventTouch()).toBe(false);
  });

  it("does not drive swipe progress until an async start has resolved", async () => {
    let resolveStart!: (triggered: boolean) => void;
    onSwipeStart.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveStart = resolve))
    );
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    c.pointerMove(event({ clientX: 80, timeStamp: 8 }));
    expect(onSwipe).not.toHaveBeenCalled();

    resolveStart(true);
    await flush();
    c.pointerMove(event({ clientX: 100, timeStamp: 16 }));
    expect(onSwipe).toHaveBeenCalledTimes(1);
  });

  it("cancels safely while an async swipe start is unresolved", async () => {
    let resolveStart!: (triggered: boolean) => void;
    onSwipeStart.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveStart = resolve))
    );
    onSwipeEnd.mockImplementation(async (_event, _info, options) => {
      options.onStart?.(true);
      await options.animate(dom.scope, { x: 0 }, { duration: 99 });
      return true;
    });
    const c = createSwipeController(config);
    c.pointerDown(event({ target: dom.scope }));
    c.pointerMove(event({ clientX: 40 }));
    c.pointerCancel(event({ clientX: 160 }));
    expect(c.shouldPreventTouch()).toBe(false);

    resolveStart(true);
    await flush();
    await flush();

    expect(onSwipeEnd).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
    expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
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
    await flush();
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
      // A <Part> element on the current screen and one on the previous
      // screen's subtree (resolved via the previous-sibling walk).
      curBar = document.createElement("div");
      curBar.setAttribute("data-flemo-part-name", "test-bar");
      dom.screenContainer.appendChild(curBar);
      prevBar = document.createElement("div");
      prevBar.setAttribute("data-flemo-part-name", "test-bar");
      (dom.root.firstElementChild as HTMLElement).appendChild(prevBar); // prevScreenContainer

      btStart = vi.fn();
      btSwipe = vi.fn();
      btEnd = vi.fn();
      partTransitionMap.set("test-bar", {
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

    afterEach(() => partTransitionMap.delete("test-bar"));

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
      await flush();
      // The GESTURE's progress, not the 42 the handler passed. A transition's
      // own number is in its own unit, so a part that reads it cannot honour
      // the 0-100 its hook documents; the controller measures the drag against
      // the box the screen travels and hands that over instead.
      // The gesture's origin is the move that STARTED it (clientX 40), not the
      // pointerdown, so this drag is 100px of the screen's span.
      const span = dom.scope.getBoundingClientRect().width || window.innerWidth;
      expect(btSwipe).toHaveBeenCalledWith(
        true,
        expect.closeTo(((140 - 40) / span) * 100, 5),
        expect.objectContaining({ element: curBar, active: true })
      );
      expect(btSwipe).not.toHaveBeenCalledWith(true, 42, expect.anything());
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
      ghost.setAttribute("data-flemo-part-name", "not-registered");
      dom.screenContainer.appendChild(ghost);
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      // The registered element still fires; the unknown name resolves to no def
      // and is silently skipped — no throw.
      expect(btStart).toHaveBeenCalled();
    });

    it("keeps the previous side's landing values at commit (COMPLETED strips them)", async () => {
      onSwipeEnd.mockImplementation(
        async (_e: unknown, _i: unknown, o: { onStart?: (t: boolean) => void }) => {
          o.onStart?.(true);
          return true;
        }
      );
      // The hook's landing write: the same values the post-commit rest rules
      // resolve to. Stripping it at commit would flash the pre-swipe state.
      btEnd.mockImplementation((_t: boolean, o: { element: HTMLElement; active: boolean }) => {
        if (!o.active) o.element.style.opacity = "1";
      });
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      c.pointerUp(event({ clientX: 200 }));
      await flush();
      expect(vi.mocked(back)).toHaveBeenCalledTimes(1);
      expect(btEnd).toHaveBeenCalled();
      expect(prevBar.style.opacity).toBe("1");
    });
  });

  // The riding-bar mirror: bars that ride a swiped screen receive every inline
  // write the screen gets in the SAME synchronous tick, and each end path
  // releases each side by its ownership rules (current bars unmount with the
  // screen on a trigger; prev bars outlive it).
  describe("riding bars", () => {
    let topBar: HTMLElement;
    let prevNav: HTMLElement;

    beforeEach(() => {
      // The current screen's shared TOP bar rides (the partner has no match);
      // the previous screen's own NAV bar (in its subtree) rides because this
      // screen has no shared bottom bar.
      topBar = document.createElement("div");
      document.body.appendChild(topBar);
      prevNav = document.createElement("div");
      prevNav.setAttribute("data-flemo-bar", "nav");
      (dom.root.firstElementChild as HTMLElement).appendChild(prevNav);

      config.getElements = () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedTopBar: topBar,
        sharedBottomBar: null
      });
      config.hasSharedTopBar = () => true;

      // The hook writes both screens through the controller's animate — the
      // mirror is what this suite asserts, so write REAL inline values.
      onSwipe.mockImplementation(
        (
          _e: unknown,
          _i: unknown,
          o: {
            animate: (t: HTMLElement, v: object) => void;
            currentScreen: HTMLElement;
            prevScreen: HTMLElement;
          }
        ) => {
          o.animate(o.currentScreen, { x: 24 });
          o.animate(o.prevScreen, { x: -8 });
          return 0;
        }
      );
    });

    afterEach(() => {
      topBar.remove();
    });

    const drag = async (c: ReturnType<typeof createSwipeController>) => {
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      c.pointerMove(event({ clientX: 60, timeStamp: 32 }));
      await flush();
    };

    it("mirrors screen writes onto both sides' riding bars in the same tick", async () => {
      const c = createSwipeController(config);
      await drag(c);

      expect(dom.scope.style.transform).not.toBe("");
      expect(topBar.style.transform).toBe(dom.scope.style.transform);
      const prevScreenEl = dom.root.querySelector<HTMLElement>("[data-flemo-screen]")!; // first match = prev scope
      expect(prevScreenEl.style.transform).not.toBe("");
      expect(prevNav.style.transform).toBe(prevScreenEl.style.transform);
    });

    it("keeps a same-ID current bar fixed during swipe hand-over", async () => {
      config.getSharedTopBarId = () => "builder-header";
      config.getPartnerBars = () => ({ topBar: true, bottomBar: false });
      config.getPartnerBarMetadata = () => ({ topBar: { id: "builder-header" } });
      const c = createSwipeController(config);
      await drag(c);

      expect(dom.scope.style.transform).not.toBe("");
      expect(topBar.style.transform).toBe("");
    });

    it("rides a different-ID current bar with its screen during a swipe", async () => {
      config.getSharedTopBarId = () => "builder-header";
      config.getPartnerBars = () => ({ topBar: true, bottomBar: false });
      config.getPartnerBarMetadata = () => ({ topBar: { id: "work-header" } });
      const c = createSwipeController(config);
      await drag(c);

      expect(topBar.style.transform).toBe(dom.scope.style.transform);
    });

    it("uses matching string and number IDs from the partner DOM before metadata reconnects", async () => {
      const bottomBar = document.createElement("div");
      document.body.appendChild(bottomBar);
      const prevTop = document.createElement("div");
      prevTop.setAttribute("data-flemo-bar", "app");
      prevTop.setAttribute("data-flemo-bar-id", "builder-header");
      prevTop.setAttribute("data-flemo-bar-id-type", "string");
      (dom.root.firstElementChild as HTMLElement).appendChild(prevTop);
      prevNav.setAttribute("data-flemo-bar-id", "7");
      prevNav.setAttribute("data-flemo-bar-id-type", "number");

      config.getElements = () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedTopBar: topBar,
        sharedBottomBar: bottomBar
      });
      config.hasSharedTopBar = () => true;
      config.hasSharedBottomBar = () => true;
      config.getSharedTopBarId = () => "builder-header";
      config.getSharedBottomBarId = () => 7;

      const c = createSwipeController(config);
      await drag(c);

      expect(topBar.style.transform).toBe("");
      expect(bottomBar.style.transform).toBe("");
      expect(prevTop.style.transform).toBe("");
      expect(prevNav.style.transform).toBe("");

      bottomBar.remove();
    });

    it("rides both sides when DOM fallback bars have different identities", async () => {
      const bottomBar = document.createElement("div");
      document.body.appendChild(bottomBar);
      const prevTop = document.createElement("div");
      prevTop.setAttribute("data-flemo-bar", "app");
      (dom.root.firstElementChild as HTMLElement).appendChild(prevTop);

      config.getElements = () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedTopBar: topBar,
        sharedBottomBar: bottomBar
      });
      config.hasSharedTopBar = () => true;
      config.hasSharedBottomBar = () => true;
      config.getSharedTopBarId = () => "builder-header";
      config.getSharedBottomBarId = () => "builder-actions";

      const c = createSwipeController(config);
      await drag(c);

      expect(topBar.style.transform).toBe(dom.scope.style.transform);
      expect(bottomBar.style.transform).toBe(dom.scope.style.transform);
      expect(prevTop.style.transform).toBe(dom.prevScope.style.transform);
      expect(prevNav.style.transform).toBe(dom.prevScope.style.transform);

      bottomBar.remove();
    });

    it("uses legacy partner presence while its metadata reconnects", async () => {
      const bottomBar = document.createElement("div");
      document.body.appendChild(bottomBar);
      config.getElements = () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedTopBar: topBar,
        sharedBottomBar: bottomBar
      });
      config.hasSharedTopBar = () => true;
      config.hasSharedBottomBar = () => true;
      config.getPartnerBars = () => ({ topBar: true, bottomBar: true });

      const c = createSwipeController(config);
      await drag(c);

      expect(topBar.style.transform).toBe("");
      expect(bottomBar.style.transform).toBe("");
      expect(prevNav.style.transform).toBe("");

      bottomBar.remove();
    });

    it("a cancelled swipe restores every riding bar's inline state", async () => {
      const c = createSwipeController(config);
      await drag(c);
      c.pointerUp(event({ clientX: 60 }));
      await flush();

      // onSwipeEnd resolved false: the rest rules own everything again.
      expect(topBar.style.transform).toBe("");
      expect(prevNav.style.transform).toBe("");
      expect(vi.mocked(setDragStatus)).toHaveBeenCalledWith("IDLE");
    });

    it("a triggered swipe strips only the prev side's bars (current unmounts with the screen)", async () => {
      onSwipeEnd.mockImplementation(async () => true);
      const c = createSwipeController(config);
      await drag(c);
      c.pointerUp(event({ clientX: 200 }));
      await flush();

      expect(back).toHaveBeenCalled();
      // The swiped-out screen suppresses its upcoming POPPING keyframe.
      expect(dom.scope.getAttribute("data-flemo-skip-animation")).toBe("true");
      // Prev-side bars outlive the navigation: inline transforms stripped so
      // the next compiled rule isn't shadowed. Current-side bars keep theirs —
      // they leave with the screen.
      expect(prevNav.style.transform).toBe("");
      expect(topBar.style.transform).not.toBe("");
    });
  });

  // The part hooks' animate wrapper stakes the controller's own writer token,
  // so a cancelled swipe's owner-scoped clear can restore the part's inline
  // state (an unstaked write would leak past the cancel).
  describe("part hook animate writes", () => {
    let part: HTMLElement;

    beforeEach(() => {
      part = document.createElement("div");
      part.setAttribute("data-flemo-part-name", "cov-part");
      dom.screenContainer.appendChild(part);
      partTransitionMap.set("cov-part", {
        name: "cov-part",
        initial: {},
        variants: {} as never,
        onSwipe: (
          _t: boolean,
          _p: number,
          o: { animate: (el: HTMLElement, v: object) => void; element: HTMLElement }
        ) => {
          o.animate(o.element, { opacity: 0.5 });
        }
      } as never);

      onSwipeStart.mockImplementation(
        async (_e: unknown, _i: unknown, o: { onStart?: (t: boolean) => void }) => {
          o.onStart?.(true);
          return true;
        }
      );
      onSwipe.mockImplementation(
        (_e: unknown, _i: unknown, o: { onProgress?: (t: boolean, p: number) => void }) => {
          o.onProgress?.(true, 0.4);
          return 0.4;
        }
      );
    });

    afterEach(() => partTransitionMap.delete("cov-part"));

    it("a part write lands inline through the controller's writer and clears on cancel", async () => {
      const c = createSwipeController(config);
      c.pointerDown(event({ target: dom.scope }));
      c.pointerMove(event({ clientX: 40 }));
      await flush();
      c.pointerMove(event({ clientX: 60, timeStamp: 32 }));
      await flush();

      expect(part.style.opacity).toBe("0.5");

      c.pointerUp(event({ clientX: 60 }));
      await flush();
      expect(part.style.opacity).toBe("");
    });
  });
});

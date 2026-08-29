import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";
import { LAYER_SETTLE_MS } from "@core/engine/layerSettleHold";

import { fullVariants } from "./variantStub";

// A gesture promotes the screens it drags (layerSettleHold) so the per-frame
// inline writes do not repaint two full-screen boxes from scratch. That
// promotion is owned by the SWIPE — the engine's own COMPLETED release runs
// under a different owner and cannot drop it — so the controller has to hand
// it back on every terminal path, the commit included.
//
// A leak here is not merely a resident layer: `will-change: transform` makes
// the element a containing block for `position: fixed` descendants, so a
// consumer's bottom sheet stays trapped inside the screen box, under the
// shared bars, for the rest of the session.
function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");
  const prevDecorator = document.createElement("div");
  prevDecorator.setAttribute("data-flemo-decorator", "");
  prevScreenContainer.append(prevScope, prevDecorator);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "");
  const decorator = document.createElement("div");
  decorator.setAttribute("data-flemo-decorator", "");
  screenContainer.append(scope, decorator);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, decorator, screenContainer, prevScope, prevDecorator };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const settle = () => new Promise((resolve) => setTimeout(resolve, LAYER_SETTLE_MS + 60));

describe("the drag layer holds", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;

  beforeEach(() => {
    dom = buildDom();

    const transition = {
      name: "layer-release",
      initial: { x: "100%" },
      // Two distinct transform targets: `collectAnimatedProperties` only
      // reports a property that actually interpolates, so a definition with a
      // single target promotes nothing and this file would assert on a layer
      // that was never taken. `initial` above is the second one.
      variants: fullVariants({ x: "0%" }, { duration: 0.3 }),
      swipeDirection: "x",
      onSwipeStart: async () => true,
      onSwipe: () => 0,
      onSwipeEnd: async (
        _event: PointerEvent,
        info: { offset: { x: number } },
        api: {
          animate: (t: unknown, v: unknown, o: { duration: number }) => void;
          currentScreen: HTMLElement;
          onStart?: (triggered: boolean) => void;
        }
      ) => {
        const triggered = info.offset.x > 50;
        api.onStart?.(triggered);
        api.animate(api.currentScreen, { x: triggered ? "100%" : 0 }, { duration: 0.3 });
        return triggered;
      }
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
      getDecorator: () => undefined,
      getElements: () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: dom.decorator,
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
    } as unknown as SwipeControllerConfig;
  });

  afterEach(() => {
    dom.root.remove();
  });

  const drag = async (controller: ReturnType<typeof createSwipeController>, toX: number) => {
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.pointerMove(event({ clientX: toX, timeStamp: 100 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.pointerUp(event({ clientX: toX, timeStamp: 100 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  };

  it("promotes the screens it drags", async () => {
    const controller = createSwipeController(config);

    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dom.scope.style.willChange).toContain("transform");
    expect(dom.prevScope.style.willChange).toContain("transform");
  });

  it("promotes both dims when the transition carries a decorator", async () => {
    const controller = createSwipeController(config);
    config.getDecorator = () =>
      ({
        name: "layer-dim",
        initial: { opacity: 0 },
        variants: fullVariants({ opacity: 1 })
      }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>;

    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dom.decorator.style.willChange).toContain("opacity");
    expect(dom.prevDecorator.style.willChange).toContain("opacity");
  });

  it("skips whichever dim is absent, and neither is guaranteed", async () => {
    // The screen's own dim is null while the drag is set up (the binding
    // renders it only for a transition that names one, and the element arrives
    // a commit later), and the PREVIOUS screen's is missing whenever that
    // container has no decorator child at all. Both are ordinary states, not
    // defensive padding, so both are driven rather than asserted away.
    dom.prevDecorator.remove();
    config.getDecorator = () =>
      ({
        name: "layer-dim",
        initial: { opacity: 0 },
        variants: fullVariants({ opacity: 1 })
      }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>;
    config.getElements = () => ({
      scope: dom.scope,
      screenContainer: dom.screenContainer,
      decorator: null,
      sharedTopBar: null,
      sharedBottomBar: null
    });

    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The gesture still runs: the screens are promoted and nothing threw on
    // the way past the two missing dims.
    expect(dom.scope.style.willChange).toContain("transform");
    expect(dom.prevScope.style.willChange).toContain("transform");
    expect(dom.decorator.style.willChange).toBe("");
  });

  // The branch this file exists for. A committed swipe hands the navigation to
  // the engine and unmounts the screen it dragged out — but the screen it
  // dragged IN survives, and its promotion is the swipe's to release.
  it("hands the promotion back when the swipe commits", async () => {
    const controller = createSwipeController(config);

    await drag(controller, 200);
    expect(config.back).toHaveBeenCalled();

    await settle();

    expect(dom.prevScope.style.willChange).toBe("");
    expect(dom.scope.style.willChange).toBe("");
  });

  it("hands the promotion back when the swipe is cancelled", async () => {
    const controller = createSwipeController(config);

    await drag(controller, 41);
    expect(config.back).not.toHaveBeenCalled();

    await settle();

    expect(dom.prevScope.style.willChange).toBe("");
    expect(dom.scope.style.willChange).toBe("");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { PART_HOME_ATTR, PART_NAME_ATTR, PART_STAND_IN_ATTR } from "@dom/attributes";

import { fullVariants } from "./variantStub";

// THE DRAG IS A FLIGHT THE ENGINE NEVER SEES.
//
// `isReadyForDrag` requires the navigate status to be COMPLETED, and nothing in
// the gesture changes it: the controller only flips its own drag status, and the
// real flight starts at `back()`. So `driveScreenLifecycle` never reports a
// transitional status while the finger is down, its staging never arms, and the
// covered screen's matched-bar parts cross-fade underneath the screen being
// dragged off them — the same occlusion the flight path exists to fix, on the
// one path it could not reach.

function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "prev-1");
  const prevBar = document.createElement("div");
  prevBar.setAttribute("data-flemo-bar", "app");
  // Matched with the dragged screen's bar: it hands over rather than rides.
  prevBar.setAttribute("data-flemo-bar-riding", "false");
  const prevPart = document.createElement("div");
  prevPart.setAttribute(PART_NAME_ATTR, "navigationIcon");
  prevBar.appendChild(prevPart);
  // A real box. jsdom lays nothing out, and staging refuses to place a part it
  // cannot measure — the guard that keeps an Activity-hidden screen's zero
  // boxes from pinning its parts to the layer's origin.
  restoreLayout = stubLayout(prevPart, 20, 28, 40, 40);
  prevScreenContainer.append(prevScope, prevBar);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "top-1");
  screenContainer.appendChild(scope);

  const layer = document.createElement("div");

  root.append(prevScreenContainer, screenContainer, layer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, screenContainer, prevBar, prevPart, layer };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

// jsdom lays nothing out. Staging reads the LAYOUT box for the size and the
// stand-in's rect for the place, so a fixture stands in for both — and the
// stand-in is created by the runtime, so its rect comes from the prototype.
const stubLayout = (element: HTMLElement, x: number, y: number, w: number, h: number) => {
  const rect = {
    x,
    y,
    width: w,
    height: h,
    top: y,
    left: x,
    right: x + w,
    bottom: y + h,
    toJSON: () => ({})
  } as DOMRect;
  element.getBoundingClientRect = () => rect;
  Object.defineProperty(element, "offsetWidth", { value: w, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: h, configurable: true });
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.hasAttribute("data-flemo-part-stand-in") ? rect : original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
};

let restoreLayout: () => void;

describe("createSwipeController shared-bar part staging", () => {
  let dom: ReturnType<typeof buildDom>;
  let back: Mock<() => void>;
  /** What the DOM looked like at the instant the commit called back(). */
  let atCommit: { staged: number; inBar: number } | null;

  const handlers = (commits: boolean) => ({
    onSwipeStart: vi.fn(async () => true),
    onSwipe: vi.fn(() => undefined),
    onSwipeEnd: vi.fn(async () => commits)
  });

  const buildConfig = (
    commits: boolean,
    overrides: Partial<SwipeControllerConfig> = {}
  ): SwipeControllerConfig => ({
    getTransition: () =>
      ({
        name: "swipe-part-staging-test",
        initial: { x: "100%" },
        variants: fullVariants({ x: 0 }, { duration: 0.3 }),
        swipeDirection: "x",
        ...handlers(commits)
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
    getPartLayer: () => dom.layer,
    setDragStatus: vi.fn(),
    back,
    ...overrides
  });

  const drag = (controller: ReturnType<typeof createSwipeController>) => {
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
  };

  beforeEach(() => {
    dom = buildDom();
    atCommit = null;
    back = vi.fn<() => void>(() => {
      atCommit = {
        staged: dom.layer.querySelectorAll(`[${PART_NAME_ATTR}]`).length,
        inBar: dom.prevBar.querySelectorAll(`[${PART_NAME_ATTR}]`).length
      };
    });
  });

  afterEach(() => {
    restoreLayout?.();
    dom.root.remove();
  });

  it("lifts the covered screen's matched-bar part once the drag is confirmed", async () => {
    const controller = createSwipeController(buildConfig(false));
    drag(controller);
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.layer);
    expect(dom.prevPart.getAttribute(PART_HOME_ATTR)).toBe("prev-1");
    expect(dom.prevBar.querySelector(`[${PART_STAND_IN_ATTR}]`)).not.toBeNull();
  });

  it("stages nothing before the drag is confirmed", async () => {
    // A touch that never becomes a gesture must leave the bar exactly as it was.
    const controller = createSwipeController(buildConfig(false));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.prevBar);
  });

  it("stages nothing for a binding that renders no layer", async () => {
    const controller = createSwipeController(buildConfig(false, { getPartLayer: () => null }));
    drag(controller);
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.prevBar);
  });

  it("leaves a riding bar's parts alone", async () => {
    // No partner owns this bar, so it travels with its screen and its parts
    // have nothing to trade places with.
    dom.prevBar.setAttribute("data-flemo-bar-riding", "true");
    const controller = createSwipeController(buildConfig(false));
    drag(controller);
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.prevBar);
  });

  it("hands the part back BEFORE the commit, so the landing flight can stage it", async () => {
    // stageBarParts collects from the bar, so a part already up in the layer
    // reads to the flight as nothing to stage. Handing it across would leave
    // the drag's own release to pull it home in the middle of the pop.
    const controller = createSwipeController(buildConfig(true));
    drag(controller);
    await flush();
    // The hand-back only means something if it was staged in the first place.
    expect(dom.prevPart.parentElement).toBe(dom.layer);

    controller.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();
    await flush();

    expect(back).toHaveBeenCalled();
    expect(atCommit).toEqual({ staged: 0, inBar: 1 });
  });

  it("stages the covered side's parts once, not again on the next frame", async () => {
    // Arming runs on every progress frame the transition reports. Once the
    // parts are up in the layer, a later frame must find them already staged
    // and do nothing more — not lift a second copy or plant a second stand-in.
    const controller = createSwipeController(
      buildConfig(false, {
        getTransition: () =>
          ({
            name: "swipe-part-staging-test",
            initial: { x: "100%" },
            variants: fullVariants({ x: 0 }, { duration: 0.3 }),
            swipeDirection: "x",
            onSwipeStart: vi.fn(async () => true),
            // Reporting progress is what drives arming on each moved frame.
            onSwipe: vi.fn((_e, _info, ctx: { onProgress: (triggered: boolean) => void }) =>
              ctx.onProgress(true)
            ),
            onSwipeEnd: vi.fn(async () => false)
          }) as unknown as Transition
      })
    );
    drag(controller);
    await flush();
    expect(dom.prevPart.parentElement).toBe(dom.layer);
    const standIns = dom.prevBar.querySelectorAll(`[${PART_STAND_IN_ATTR}]`).length;

    // A further frame of the same drag reports progress and drives arming
    // again while the parts are already staged.
    controller.pointerMove(event({ clientX: 80, clientY: 100 }));
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.layer);
    expect(dom.layer.querySelectorAll(`[${PART_NAME_ATTR}]`).length).toBe(1);
    expect(dom.prevBar.querySelectorAll(`[${PART_STAND_IN_ATTR}]`).length).toBe(standIns);
  });

  it("brings the part home when the drag is cancelled", async () => {
    const controller = createSwipeController(buildConfig(false));
    drag(controller);
    await flush();
    // As above: a part that was never lifted proves nothing about the return.
    expect(dom.prevPart.parentElement).toBe(dom.layer);

    controller.pointerUp(event({ clientX: 4, clientY: 100 }));
    await flush();
    await flush();

    expect(dom.prevPart.parentElement).toBe(dom.prevBar);
    expect(dom.prevBar.querySelector(`[${PART_STAND_IN_ATTR}]`)).toBeNull();
    expect(dom.prevPart.hasAttribute(PART_HOME_ATTR)).toBe(false);
  });
});

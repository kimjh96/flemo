import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import {
  BAR_ATTR,
  BAR_RIDING_ATTR,
  DECORATOR_ATTR,
  PART_HOME_ATTR,
  PART_NAME_ATTR,
  PART_STAND_IN_ATTR,
  SCREEN_ATTR
} from "@dom/attributes";

import createRawPartTransition from "@transition/partTransition/createRawPartTransition";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import { fullVariants } from "./variantStub";

import type { PartTransitionName } from "@transition/partTransition/typing";

// NOTHING ELSE MOVES A DRAG'S CHROME.
//
// The compiled rules key on a navigate status no drag ever sets, so a part or a
// decorator that declared only a pose sat still while the screens followed the
// finger. The controller drives those itself: every registered element that
// declared no swipe hooks rides the gesture on the same two POPPING variants the
// landing flight would run, because a swipe-back IS a pop.

const POSE_ONLY = "drag-rider-pose" as PartTransitionName;
const AUTHOR_DRIVEN = "drag-rider-authored" as PartTransitionName;

const poseOnly = createRawPartTransition({
  name: POSE_ONLY,
  initial: { opacity: 0 },
  idle: { value: { opacity: 1 }, options: { duration: 0 } },
  pushOnEnter: { value: { opacity: 1 } },
  pushOnExit: { value: { opacity: 0 } },
  replaceOnEnter: { value: { opacity: 1 } },
  replaceOnExit: { value: { opacity: 0 } },
  popOnEnter: { value: { opacity: 0 } },
  popOnExit: { value: { opacity: 1 } },
  completedOnEnter: { value: { opacity: 1 }, options: { duration: 0 } },
  completedOnExit: { value: { opacity: 0 }, options: { duration: 0 } }
});

// Same pose, but the author took the element over with a swipe hook.
const authorDriven = { ...poseOnly, name: AUTHOR_DRIVEN, onSwipe: vi.fn() };

/** Record every animate() the gesture stages, per element. */
const animated = new WeakMap<HTMLElement, number>();

const stubAnimate = (element: HTMLElement) => {
  element.animate = vi.fn(() => {
    animated.set(element, (animated.get(element) ?? 0) + 1);
    return {
      currentTime: 0,
      playbackRate: 1,
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      finish: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      effect: { getComputedTiming: () => ({ duration: 300, delay: 0 }) }
    } as unknown as Animation;
  }) as unknown as HTMLElement["animate"];
};

const rides = (element: HTMLElement) => (animated.get(element) ?? 0) > 0;

const part = (name: PartTransitionName) => {
  const element = document.createElement("div");
  element.setAttribute(PART_NAME_ATTR, name);
  stubAnimate(element);
  return element;
};

// jsdom lays nothing out, and the riders only arm once the covered side's bar
// parts have been staged — which refuses a part it cannot measure. So the
// fixture stands in for the layout engine, on the part and on the runtime's own
// stand-in.
const stubLayout = (element: HTMLElement) => {
  const rect = {
    x: 20,
    y: 28,
    width: 40,
    height: 40,
    top: 28,
    left: 20,
    right: 60,
    bottom: 68,
    toJSON: () => ({})
  } as DOMRect;
  element.getBoundingClientRect = () => rect;
  Object.defineProperty(element, "offsetWidth", { value: 40, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: 40, configurable: true });
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return this.hasAttribute(PART_STAND_IN_ATTR) ? rect : original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
};

let restoreLayout: (() => void) | undefined;

function buildDom(options: { nestScope?: boolean } = {}) {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute(SCREEN_ATTR, "prev-1");
  const prevPart = part(POSE_ONLY);
  prevScope.appendChild(prevPart);
  const prevDecorator = document.createElement("div");
  prevDecorator.setAttribute(DECORATOR_ATTR, "");
  stubAnimate(prevDecorator);
  // The covered screen's matched bar. Its part is what the drag stages, and
  // nothing else in the gesture arms until that staging has taken.
  const prevBar = document.createElement("div");
  prevBar.setAttribute(BAR_ATTR, "app");
  prevBar.setAttribute(BAR_RIDING_ATTR, "false");
  const barPart = part(POSE_ONLY);
  prevBar.appendChild(barPart);
  restoreLayout = stubLayout(barPart);
  prevScreenContainer.append(prevScope, prevDecorator, prevBar);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute(SCREEN_ATTR, "top-1");
  const currentPart = part(POSE_ONLY);
  const authoredPart = part(AUTHOR_DRIVEN);
  scope.append(currentPart, authoredPart);
  // A binding is free to wrap its scope; the controller is handed the scope
  // directly and never assumes it is the container's own child.
  if (options.nestScope) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(scope);
    screenContainer.appendChild(wrapper);
  } else {
    screenContainer.appendChild(scope);
  }

  const decorator = document.createElement("div");
  decorator.setAttribute(DECORATOR_ATTR, "");
  stubAnimate(decorator);

  const layer = document.createElement("div");

  root.append(prevScreenContainer, screenContainer, layer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return {
    root,
    scope,
    screenContainer,
    decorator,
    layer,
    prevDecorator,
    prevPart,
    barPart,
    currentPart,
    authoredPart
  };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("createSwipeController drag riders", () => {
  let dom: ReturnType<typeof buildDom>;

  const poseDecorator = () =>
    ({
      name: "drag-rider-dim",
      initial: { opacity: 0 },
      variants: fullVariants({ opacity: 1 })
    }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>;

  const buildConfig = (overrides: Partial<SwipeControllerConfig> = {}): SwipeControllerConfig => ({
    getTransition: () =>
      ({
        name: "drag-riders-test",
        initial: { x: "100%" },
        variants: fullVariants({ x: 0 }, { duration: 0.3 }),
        swipeDirection: "x",
        onSwipeStart: vi.fn(async () => true),
        onSwipe: vi.fn(() => undefined),
        onSwipeEnd: vi.fn(async () => false)
      }) as unknown as Transition,
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
    getPartLayer: () => dom.layer,
    setDragStatus: vi.fn(),
    back: vi.fn(),
    ...overrides
  });

  const drag = (controller: ReturnType<typeof createSwipeController>) => {
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
  };

  beforeEach(() => {
    dom = buildDom();
    partTransitionMap.set(POSE_ONLY, poseOnly);
    partTransitionMap.set(AUTHOR_DRIVEN, authorDriven as never);
  });

  afterEach(() => {
    restoreLayout?.();
    partTransitionMap.delete(POSE_ONLY);
    partTransitionMap.delete(AUTHOR_DRIVEN);
    dom.root.remove();
  });

  it("drives both screens' pose-only parts on the pop variants", async () => {
    const controller = createSwipeController(buildConfig());
    drag(controller);
    await flush();

    expect(rides(dom.currentPart)).toBe(true);
    expect(rides(dom.prevPart)).toBe(true);
  });

  it("leaves a part whose author wrote a swipe hook to its author", async () => {
    const controller = createSwipeController(buildConfig());
    drag(controller);
    await flush();

    expect(rides(dom.authoredPart)).toBe(false);
  });

  it("leaves a part nobody registered alone", async () => {
    const stray = part("unregistered-part" as PartTransitionName);
    dom.scope.appendChild(stray);

    const controller = createSwipeController(buildConfig());
    drag(controller);
    await flush();

    expect(rides(stray)).toBe(false);
  });

  it("carries both screens' decorators when the dim declared only a pose", async () => {
    const controller = createSwipeController(buildConfig({ getDecorator: poseDecorator }));
    drag(controller);
    await flush();

    expect(rides(dom.decorator)).toBe(true);
    expect(rides(dom.prevDecorator)).toBe(true);
  });

  it("leaves a decorator whose author wrote a swipe hook alone", async () => {
    const controller = createSwipeController(
      buildConfig({
        getDecorator: () =>
          ({
            ...poseDecorator(),
            onSwipe: vi.fn()
          }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>
      })
    );
    drag(controller);
    await flush();

    expect(rides(dom.decorator)).toBe(false);
    expect(rides(dom.prevDecorator)).toBe(false);
  });

  it("rides the current screen's decorator even where the binding renders none for it", async () => {
    // getElements may report no decorator for the entering side; the covered
    // screen's still has to move.
    const controller = createSwipeController(
      buildConfig({
        getDecorator: poseDecorator,
        getElements: () => ({
          scope: dom.scope,
          screenContainer: dom.screenContainer,
          decorator: null,
          sharedTopBar: null,
          sharedBottomBar: null
        })
      })
    );
    drag(controller);
    await flush();

    expect(rides(dom.prevDecorator)).toBe(true);
  });

  it("collects a part this screen already has up in the layer", async () => {
    // An interrupted flight can leave the covered screen's part staged when the
    // finger goes down. It is out of the container the gesture walks, and a part
    // the gesture cannot see is one it cannot move: it would hang at its
    // pre-drag pose while everything else followed the finger.
    const alreadyStaged = part(POSE_ONLY);
    alreadyStaged.setAttribute(PART_HOME_ATTR, "prev-1");
    dom.layer.appendChild(alreadyStaged);

    const controller = createSwipeController(buildConfig());
    drag(controller);
    await flush();

    expect(rides(alreadyStaged)).toBe(true);
  });

  it("gives no rider to a decorator that declared an instant clock", async () => {
    // Nothing to scrub over zero seconds, and staging an empty animation would
    // pin the element for a gesture that never moves it.
    const controller = createSwipeController(
      buildConfig({
        getDecorator: () =>
          ({
            name: "drag-rider-instant-dim",
            initial: { opacity: 0 },
            variants: fullVariants({ opacity: 1 }, { duration: 0 })
          }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>
      })
    );
    drag(controller);
    await flush();

    expect(rides(dom.decorator)).toBe(false);
    expect(rides(dom.prevDecorator)).toBe(false);
  });

  it("takes only what is in place where a container has no scope of its own", async () => {
    // A wrapped scope leaves the container with no screen id, so there is
    // nothing to match a staged part's home marker against and the collection
    // is whatever is in place. A part inside that wrapped scope reads like a
    // nested Router's and is left where it is, which is what the filter is for.
    restoreLayout?.();
    dom.root.remove();
    dom = buildDom({ nestScope: true });
    const controller = createSwipeController(buildConfig());
    drag(controller);
    await flush();

    expect(rides(dom.currentPart)).toBe(false);
    // The covered side is untouched by the wrapping and still rides.
    expect(rides(dom.prevPart)).toBe(true);
  });

  it("arms the riders inline on a host with no frame clock", async () => {
    // The arming waits a frame because the covered screen may still be
    // unfreezing; a host without requestAnimationFrame has no frame to wait for
    // and must not simply skip it.
    const raf = globalThis.requestAnimationFrame;
    Reflect.deleteProperty(globalThis, "requestAnimationFrame");

    try {
      const controller = createSwipeController(buildConfig());
      drag(controller);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(rides(dom.currentPart)).toBe(true);
    } finally {
      globalThis.requestAnimationFrame = raf;
    }
  });
});

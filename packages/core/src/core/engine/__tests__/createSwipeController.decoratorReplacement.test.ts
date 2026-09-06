import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { DECORATOR_ATTR, DECORATOR_OWNER_ATTR, SCREEN_ATTR } from "@dom/attributes";

import { fullVariants } from "./variantStub";

// THE DIM MOVES HOUSE IN THE MIDDLE OF THE GESTURE.
//
// A drag's first act is to WAKE the screen it reveals, and that wake re-mounts
// that screen's `<Layer>` slots — which is what decides where its dim is
// rendered. With a slot the dim is portalled into the layer host so it can
// cover what the overlay carried out; without one it sits in the screen's own
// container. A screen frozen while holding an overlay loses the slot on the
// freeze and takes it back on the wake, so the dim is REPLACED, by a fresh
// element in the other place, inside the first commits of the drag.
//
// The controller used to resolve the dim once, in beginSwipe, and hand that
// handle to every decorator hook for the rest of the gesture. Device-reported
// and reproduced in a consumer app: after resting on a pushed screen long
// enough for the covered one to freeze, the dim did not follow the finger at
// all. Measured off the recording, it held at exactly its full rest value for
// the whole drag AND the whole landing, then vanished in a single frame 0.7s
// after the commit — the moment COMPLETED flipped it to its idle rule. Every
// write the gesture made had gone into a node that left the document.

const DIM_OWNER = "prev-1";

function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute(SCREEN_ATTR, DIM_OWNER);
  // The layer host is a SIBLING of the covered screen's scope, inside its own
  // container — which is exactly why an own-child query cannot find a dim that
  // has moved into it.
  const layerHost = document.createElement("div");
  prevScreenContainer.append(prevScope, layerHost);

  const containerDim = document.createElement("div");
  containerDim.setAttribute(DECORATOR_ATTR, "");
  containerDim.setAttribute(DECORATOR_OWNER_ATTR, DIM_OWNER);
  prevScreenContainer.appendChild(containerDim);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute(SCREEN_ATTR, "top-1");
  screenContainer.appendChild(scope);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, screenContainer, prevScreenContainer, layerHost, containerDim };
}

/** What the wake does: the dim leaves the container and re-mounts in the host. */
const rehomeDim = (dom: ReturnType<typeof buildDom>) => {
  dom.containerDim.remove();
  const hostDim = document.createElement("div");
  hostDim.setAttribute(DECORATOR_ATTR, "");
  hostDim.setAttribute(DECORATOR_OWNER_ATTR, DIM_OWNER);
  dom.layerHost.appendChild(hostDim);
  return hostDim;
};

/** A WAAPI stub that records which elements the controller staged against. */
const stubAnimateInto = (element: HTMLElement, staged: HTMLElement[]) => {
  element.animate = ((keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    staged.push(element);
    return {
      currentTime: 0,
      startTime: 0,
      playbackRate: 1,
      timeline: { currentTime: 0 },
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      effect: { getKeyframes: () => keyframes, getTiming: () => options }
    } as unknown as Animation;
  }) as HTMLElement["animate"];
};

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("createSwipeController decorator replacement", () => {
  let dom: ReturnType<typeof buildDom>;

  // A dim written the way `overlay` is: the author owns the element and moves
  // it from the hooks, so the controller drives nothing of its own.
  const hookDecorator = () =>
    ({
      name: "replacement-dim",
      initial: { opacity: 0 },
      variants: fullVariants({ opacity: 1 }),
      onSwipe: (_: boolean, progress: number, { animate, prevDecorator }: never & never) =>
        (animate as (el: HTMLElement, value: object, options: object) => void)(
          prevDecorator as unknown as HTMLElement,
          { opacity: Math.max(0, 1 - progress / 100) },
          { duration: 0 }
        ),
      onSwipeEnd: (triggered: boolean, { animate, prevDecorator }: never & never) =>
        (animate as (el: HTMLElement, value: object, options: object) => void)(
          prevDecorator as unknown as HTMLElement,
          { opacity: triggered ? 0 : 1 },
          { duration: 0.3 }
        )
    }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>;

  // A dim written the other way: poses only, so the controller stages and
  // scrubs the animations itself.
  const poseDecorator = () =>
    ({
      name: "pose-only-dim",
      initial: { opacity: 0 },
      variants: fullVariants({ opacity: 1 }, { duration: 0.3 })
    }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>;

  const buildConfig = (overrides: Partial<SwipeControllerConfig> = {}): SwipeControllerConfig => ({
    getTransition: () =>
      ({
        name: "decorator-replacement-test",
        initial: { x: "100%" },
        variants: fullVariants({ x: 0 }, { duration: 0.3 }),
        swipe: {
          direction: "x",
          onStart: vi.fn(async () => true),
          onMove: vi.fn((_: unknown, __: unknown, { onProgress }: { onProgress?: () => void }) =>
            onProgress?.()
          ),
          onEnd: vi.fn(
            async (_: unknown, __: unknown, { onStart }: { onStart?: (t: boolean) => void }) => {
              onStart?.(false);
              return false;
            }
          )
        }
      }) as unknown as Transition,
    getDecorator: hookDecorator,
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
    ...overrides
  });

  beforeEach(() => {
    dom = buildDom();
  });

  afterEach(() => {
    dom.root.remove();
  });

  it("drives the dim the wake put in the layer host, not the one it replaced", async () => {
    const controller = createSwipeController(buildConfig());
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    // The move that crosses the slop STARTS the drag; the next one follows it.
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    controller.pointerMove(event({ clientX: 80, clientY: 100 }));
    await flush();

    const before = dom.containerDim.style.opacity;
    expect(before).not.toBe("");

    // The reveal lands: the covered screen's `<Layer>` slot comes back and its
    // dim is re-rendered somewhere else.
    const hostDim = rehomeDim(dom);

    controller.pointerMove(event({ clientX: 120, clientY: 100 }));
    await flush();

    // The gesture followed the element that is on screen...
    expect(hostDim.style.opacity).not.toBe("");
    expect(Number(hostDim.style.opacity)).toBeLessThan(Number(before));
    // ...and wrote nothing more into the one that left.
    expect(dom.containerDim.style.opacity).toBe(before);
  });

  it("hands the release the replacement, so the settle is not written into a ghost", async () => {
    // Read inside the hook: the cancel path strips the dim's inline values as
    // soon as the handler resolves, and this stub resolves at once where a real
    // preset awaits its screens.
    const settled: { element: HTMLElement | null; transition: string }[] = [];
    const controller = createSwipeController(
      buildConfig({
        getDecorator: () =>
          ({
            ...(hookDecorator() as unknown as Record<string, unknown>),
            onSwipeEnd: (
              _: boolean,
              {
                animate,
                prevDecorator
              }: {
                animate: (el: HTMLElement, value: object, options: object) => void;
                prevDecorator: HTMLElement;
              }
            ) => {
              animate(prevDecorator, { opacity: 1 }, { duration: 0.3 });
              settled.push({ element: prevDecorator, transition: prevDecorator.style.transition });
            }
          }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>
      })
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    controller.pointerMove(event({ clientX: 80, clientY: 100 }));
    await flush();

    const hostDim = rehomeDim(dom);
    controller.pointerMove(event({ clientX: 120, clientY: 100 }));
    await flush();

    controller.pointerUp(event({ clientX: 120, clientY: 100 }));
    await flush();

    expect(settled).toHaveLength(1);
    expect(settled[0]!.element).toBe(hostDim);
    // A cancelled release walks the dim back to full over a real span: this is
    // the write the defect swallowed entirely.
    expect(settled[0]!.transition).toContain("opacity");
  });

  it("leaves a pose-only dim that is still in the document staged once", async () => {
    // The other side of the re-stage below: a rider that is fine must be left
    // alone. Re-staging one every follow frame would rebuild its animation from
    // zero on each of them, which is a dim that never moves by another route.
    const staged: HTMLElement[] = [];
    stubAnimateInto(dom.containerDim, staged);

    const controller = createSwipeController(buildConfig({ getDecorator: poseDecorator }));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    controller.pointerMove(event({ clientX: 80, clientY: 100 }));
    await flush();
    controller.pointerMove(event({ clientX: 120, clientY: 100 }));
    await flush();

    expect(staged.filter((element) => element === dom.containerDim)).toHaveLength(1);
  });

  it("re-stages a pose-only dim the wake replaced", async () => {
    // The other half of the same hazard: a decorator with no hooks is driven by
    // the controller's own rider animations, and an animation does not follow
    // its element out of the document.
    const staged: HTMLElement[] = [];
    stubAnimateInto(dom.containerDim, staged);

    const controller = createSwipeController(buildConfig({ getDecorator: poseDecorator }));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    expect(staged).toContain(dom.containerDim);

    const hostDim = rehomeDim(dom);
    stubAnimateInto(hostDim, staged);

    controller.pointerMove(event({ clientX: 120, clientY: 100 }));
    await flush();

    expect(staged).toContain(hostDim);
  });
});

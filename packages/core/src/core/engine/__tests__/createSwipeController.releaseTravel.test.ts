import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";
import { MAX_RELEASE_SPEEDUP } from "@transition/swipeSettle";
import type { Transition } from "@transition/typing";
import { TRANSITION_VARIANTS } from "@transition/variantMotion";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

// WHERE THE SCREEN IS, NOT WHERE THE FINGER WENT.
//
// The release clock and the gesture's reported progress both used to be read
// off `Math.abs(offset)` — the raw distance between the finger and where the
// drag began, sign discarded. That is the same number as the screen's travel
// only for a finger that never turns round and never runs past the end, and a
// real one does both:
//
//   * DRAGGED BACK PAST THE START. Every built-in handler clamps at rest
//     (cupertino writes `Math.max(0, dragX)`), so the screen sits still while
//     `|offset|` keeps growing. The dim, driven by that number, went on
//     lifting off a screen that was not moving, and a release there told the
//     settle most of the trip was already done — so a commit crossed the whole
//     screen in the time that was left for the last few pixels. Reported as
//     "the overlay does not follow the drag, and then it vanishes with no
//     transition", after dragging left and right and letting go in the middle.
//   * RUN PAST THE END. `span - travelled` goes negative and is read through
//     an `Math.abs`, so a long drag reports a growing remainder again.
//
// The gesture's travel is therefore the SIGNED offset along the swipe axis,
// clamped to the screen it is dragging. A swipe only ever starts in the
// positive direction of its axis (see pointerMove's intent gate), so the
// clamp is the whole rule.

const fullVariants = (value: TransitionTarget, options?: AnimationOptions) =>
  Object.fromEntries(
    TRANSITION_VARIANTS.map((variant) => [variant, { value, options }])
  ) as Transition["variants"];

const AUTHORED = 0.7;
const EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

function buildDom() {
  const root = document.createElement("div");
  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "prev");
  const prevDecorator = document.createElement("div");
  prevDecorator.setAttribute("data-flemo-decorator", "");
  prevScreenContainer.append(prevScope, prevDecorator);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "current");
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

const frame = () => new Promise((resolve) => setTimeout(resolve, 0));
// The follow is queued on rAF, which jsdom serves off its own ~16ms timer —
// a zero-delay task never reaches it. Anything asserting on what the DRAG
// wrote has to wait for a real frame.
const painted = () => new Promise((resolve) => setTimeout(resolve, 32));

const secondsOn = (el: HTMLElement) => {
  const match = /([\d.]+)s/.exec(el.style.transition);
  return match ? Number(match[1]) : null;
};

describe("the gesture's travel", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  let progressReports: number[];
  // Every built-in handler clamps its screen at rest, which is the whole
  // reason the raw offset is the wrong number.
  let clampedX: number[];

  beforeEach(() => {
    dom = buildDom();
    progressReports = [];
    clampedX = [];

    const transition = {
      name: "travel-clock",
      initial: { x: "100%" },
      variants: fullVariants({ x: 0 }, { duration: AUTHORED, ease: EASE }),
      swipe: {
        direction: "x",
        onStart: async () => true,
        onMove: (
          _event: PointerEvent,
          info: { offset: { x: number } },
          api: {
            animate: (t: unknown, v: unknown, o: { duration: number }) => void;
            currentScreen: HTMLElement;
            onProgress?: (t: boolean) => void;
          }
        ) => {
          api.onProgress?.(true);
          clampedX.push(Math.max(0, info.offset.x));
          api.animate(api.currentScreen, { x: Math.max(0, info.offset.x) }, { duration: 0 });
          return 0;
        },
        onEnd: async (
          _event: PointerEvent,
          info: { offset: { x: number }; velocity: { x: number } },
          api: {
            animate: (t: unknown, v: unknown, o: { duration: number; ease?: unknown }) => void;
            currentScreen: HTMLElement;
            onStart?: (triggered: boolean) => void;
          }
        ) => {
          // Cupertino's own rule: a flick commits whatever the offset says.
          const triggered = info.offset.x > 50 || info.velocity.x > 20;
          api.onStart?.(triggered);
          api.animate(
            api.currentScreen,
            { x: triggered ? "100%" : 0 },
            { duration: AUTHORED, ease: EASE }
          );
          return triggered;
        }
      }
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
      getDecorator: () =>
        ({
          name: "travel-dim",
          initial: { opacity: 0 },
          variants: fullVariants({ opacity: 1 }),
          onSwipe: (
            _triggered: boolean,
            progress: number,
            api: {
              animate: (t: unknown, v: unknown, o: { duration: number }) => void;
              prevDecorator: HTMLElement;
            }
          ) => {
            progressReports.push(progress);
            api.animate(
              api.prevDecorator,
              { opacity: Math.max(0, 1 - progress / 100) },
              { duration: 0 }
            );
          }
        }) as unknown as ReturnType<SwipeControllerConfig["getDecorator"]>,
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
    };
  });

  afterEach(() => {
    dom.root.remove();
  });

  const span = () => window.innerWidth;

  it("reports no progress while the finger is behind where the drag began", async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    // Out to a third of the screen...
    controller.pointerMove(event({ clientX: 40 + span() / 3, timeStamp: 100 }));
    await painted();
    // ...and back past the start. The handler clamps the screen at rest here,
    // so the gesture has carried it nowhere.
    controller.pointerMove(event({ clientX: 40 - span() / 3, timeStamp: 200 }));
    await painted();

    expect(clampedX[clampedX.length - 1]).toBe(0);
    // The dim is driven by the same number, so it must read the same rest.
    expect(progressReports[progressReports.length - 1]).toBe(0);
    expect(dom.prevDecorator.style.opacity).toBe("1");
  });

  it("gives a commit from behind the start the whole screen to cross", async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    controller.pointerMove(event({ clientX: 40 + span() / 2, timeStamp: 100 }));
    await frame();
    // Back behind the start, then let go while still flicking forward: the
    // handler's velocity rule commits.
    controller.pointerMove(event({ clientX: 40 - 600, timeStamp: 400 }));
    await painted();
    controller.pointerMove(event({ clientX: 40 - 590, timeStamp: 460 }));
    await painted();
    controller.pointerUp(event({ clientX: 40 - 590, timeStamp: 460 }));
    await frame();

    const seconds = secondsOn(dom.scope);
    expect(seconds).not.toBeNull();
    // The screen is at rest and has the WHOLE span to cross, so the landing is
    // the authored motion itself. Reading the travel off `|offset|` said 590px
    // were already behind it and handed the landing barely half the time.
    expect(seconds!).toBeCloseTo(AUTHORED, 2);
  });

  it("never lets a flick land faster than the eye can follow", async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    // A real flick: 200px in 8ms is 25000 px/s, which is what a coalesced
    // pointer stream reports for a fast finger.
    controller.pointerMove(event({ clientX: 240, timeStamp: 8 }));
    await frame();
    controller.pointerUp(event({ clientX: 240, timeStamp: 8 }));
    await frame();

    const seconds = secondsOn(dom.scope);
    expect(seconds).not.toBeNull();
    const remainingPx = span() - 200;
    // The landing may be quick; it may not be a cut. Past a few times the
    // authored average speed the screen reads as snatched away rather than as
    // moving.
    const speed = remainingPx / seconds!;
    expect(speed).toBeLessThanOrEqual((span() / AUTHORED) * MAX_RELEASE_SPEEDUP + 1);
  });

  it("forgets the speed of a finger that stopped before it let go", async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    controller.pointerMove(event({ clientX: 340, timeStamp: 40 }));
    await frame();
    // Held still for a third of a second, then released. The gesture has no
    // momentum left to lend the landing.
    controller.pointerUp(event({ clientX: 340, timeStamp: 380 }));
    await frame();

    const seconds = secondsOn(dom.scope);
    expect(seconds).not.toBeNull();
    // With the speed term gone the distance term decides, and 300px of a
    // ~1000px screen leaves most of the authored curve to run.
    expect(seconds!).toBeGreaterThan(0.3);
  });
});

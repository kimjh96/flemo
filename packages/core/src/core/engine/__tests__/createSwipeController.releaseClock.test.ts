import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";
import { partTransitionMap } from "@transition/partTransition/partTransition";

// The release clock belongs to the CONTROLLER, not to any preset: a release is
// the continuation of a gesture, so its length comes from what is left to
// travel and how fast the finger was going, with the handler's own duration as
// the ceiling. Putting it here is what makes it automatic — a transition
// written by a consumer tomorrow gets it without asking, and so do its
// decorator and its parts, because every release write passes through here.
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
  const part = document.createElement("div");
  part.setAttribute("data-flemo-part-name", "clock-part");
  scope.appendChild(part);
  const decorator = document.createElement("div");
  decorator.setAttribute("data-flemo-decorator", "");
  screenContainer.append(scope, decorator);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  // jsdom has no layout: the controller falls back to the window axis, which
  // is the span these cases reason about.
  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, decorator, screenContainer, prevScope, prevDecorator, part };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const frame = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the release clock", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  const AUTHORED = 0.7;

  beforeEach(() => {
    dom = buildDom();

    partTransitionMap.set("clock-part", {
      name: "clock-part",
      onSwipeEnd: (
        _triggered: boolean,
        {
          animate,
          element
        }: {
          animate: (t: HTMLElement, v: unknown, o: { duration: number }) => void;
          element: HTMLElement;
        }
      ) => {
        animate(element, { opacity: 1 }, { duration: AUTHORED });
      }
    } as never);

    const transition = {
      name: "release-clock",
      initial: { x: "100%" },
      variants: {} as Transition["variants"],
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
        api.animate(api.currentScreen, { x: triggered ? "100%" : 0 }, { duration: AUTHORED });
        return triggered;
      }
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
      getDecorator: () =>
        ({
          name: "clock-dim",
          initial: { opacity: 0 },
          variants: {},
          onSwipeEnd: (
            _triggered: boolean,
            api: {
              animate: (t: unknown, v: unknown, o: { duration: number }) => void;
              prevDecorator: HTMLElement;
            }
          ) => {
            api.animate(api.prevDecorator, { opacity: 0 }, { duration: AUTHORED });
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
    partTransitionMap.delete("clock-part");
  });

  // Read the duration the element's inline transition actually carries: that
  // is what the write landed with, whoever wrote it.
  // A CANCEL clears its inline styles once the settle lands, so reading the
  // element afterwards finds nothing: watch what was written instead.
  const watchSeconds = (el: HTMLElement) => {
    const written: number[] = [];
    const observer = new MutationObserver(() => {
      const match = /([\d.]+)s/.exec(el.style.transition);
      if (match) written.push(Number(match[1]));
    });
    observer.observe(el, { attributes: true, attributeFilter: ["style"] });
    return {
      stop: () => {
        observer.disconnect();
        return written;
      }
    };
  };

  const secondsOn = (el: HTMLElement) => {
    const match = /([\d.]+)s/.exec(el.style.transition);
    return match ? Number(match[1]) : null;
  };

  const release = async (toX: number, stepMs: number) => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    controller.pointerMove(event({ clientX: toX, timeStamp: stepMs }));
    await frame();
    controller.pointerUp(event({ clientX: toX, timeStamp: stepMs }));
    await frame();
  };

  it("shortens a handler's authored duration to what the gesture asks for", async () => {
    // Half the window travelled, then a long pause: little speed, half the
    // distance left → about half the authored span.
    await release(Math.round(window.innerWidth / 2), 4000);

    const seconds = secondsOn(dom.scope);
    expect(seconds).not.toBeNull();
    expect(seconds!).toBeLessThan(AUTHORED);
    expect(seconds!).toBeGreaterThan(0.2);
  });

  it("puts the decorator and the parts on that same clock", async () => {
    await release(Math.round(window.innerWidth / 2), 4000);

    const screen = secondsOn(dom.scope);
    expect(secondsOn(dom.prevDecorator)).toBe(screen);
    expect(secondsOn(dom.part)).toBe(screen);
  });

  it("keeps a flick short instead of stretching it to the authored span", async () => {
    // Same distance, covered fast: the finger's own speed decides.
    await release(Math.round(window.innerWidth / 2), 40);

    const fast = secondsOn(dom.scope)!;
    expect(fast).toBeLessThan(0.2);
  });

  it("never exceeds the duration the handler authored", async () => {
    // A short, slow drag leaves nearly a whole screen to travel: the distance
    // term wants almost everything, and the handler's own number is the cap.
    // (The clamp itself is pinned in swipeSettle's own suite.)
    await release(140, 4000);

    const seconds = secondsOn(dom.scope)!;
    expect(seconds).toBeLessThanOrEqual(AUTHORED);
    expect(seconds).toBeGreaterThan(AUTHORED / 2);
  });

  // A CANCEL is the settle walking BACK the way the finger came, and it only
  // ever happens below the transition's commit threshold — so the distance
  // term is tiny by construction and used to hand every cancel the short
  // floor, snapping the authored curve (device-reported on Safari after a
  // small drag).
  it("gives a cancelled swipe time to be seen", async () => {
    // 40px of travel (the helper starts the drag at x=40), released gently:
    // under the handler's 50px commit threshold, so this cancels.
    const watch = watchSeconds(dom.scope);
    await release(80, 400);
    const written = watch.stop();

    expect(written.length).toBeGreaterThan(0);
    expect(Math.max(...written)).toBeGreaterThanOrEqual(0.28);
    expect(Math.max(...written)).toBeLessThanOrEqual(AUTHORED);
  });

  it("still lets a deliberate flick back land fast", async () => {
    const watch = watchSeconds(dom.scope);
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40, timeStamp: 0 }));
    await frame();
    controller.pointerMove(event({ clientX: 120, timeStamp: 100 }));
    await frame();
    // The finger turns around and throws it home: 60px back in 50ms, which is
    // 1200px/s — a deliberate flick, not the drift of easing off.
    controller.pointerMove(event({ clientX: 60, timeStamp: 150 }));
    await frame();
    controller.pointerUp(event({ clientX: 60, timeStamp: 150 }));
    await frame();
    const written = watch.stop();

    expect(written.length).toBeGreaterThan(0);
    expect(Math.min(...written)).toBeLessThan(0.28);
  });

  it("leaves a tap-like release instant, as before", async () => {
    // Under the tap slop there is no gesture to continue: the restore must not
    // become a visible animation just because a clock now exists.
    // 4px past the point the swipe began — under the tap slop.
    await release(44, 4000);

    // No timed transition was ever authored; the cancel path then hands the
    // element back to its rest rules.
    expect(secondsOn(dom.scope)).toBeNull();
  });
});

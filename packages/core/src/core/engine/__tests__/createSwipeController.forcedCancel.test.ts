import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { fullVariants } from "./variantStub";

// A GESTURE THE BROWSER TAKES AWAY STILL HAS TO PUT THE SCREEN BACK.
//
// `pointercancel` (and a lost capture, which routes into it) means the browser
// or OS claimed the pointer. The screen is wherever the finger left it and has
// to walk home. It used to teleport instead: measured off a 60fps screen
// recording, a screen that had travelled 176px was back at rest between two
// consecutive frames, 16.7ms apart, with no pop and no return motion.
//
// Two things did that, and both are here:
//   - `tapLike` counted a forced cancel as a TAP, clamping every release write
//     to `duration: 0`. A tap is a sub-slop release; a cancel after a third of
//     a screen is not one.
//   - the neutral sample the handler is given so it cannot read a cancel as a
//     commit was also handed to the release clock, which then had no distance
//     to travel — and `swipeSettleSeconds` answers a zero distance with zero
//     seconds.
//
// `abandon` already stated the rule the code broke: "a recovery that teleported
// the screen would trade one visible defect for another".

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

  return { root, scope, screenContainer, prevScope };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

const AUTHORED = 0.7;

describe("a cancelled swipe", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  let handlerSawOffset: number | null;

  beforeEach(() => {
    dom = buildDom();
    handlerSawOffset = null;

    const transition = {
      name: "forced-cancel",
      initial: { x: "100%" },
      variants: fullVariants({ x: 0 }, { duration: AUTHORED }),
      swipe: {
        direction: "x",
        onStart: async () => true,
        onMove: () => 0,
        onEnd: async (
          _event: PointerEvent,
          info: { offset: { x: number } },
          api: {
            animate: (t: unknown, v: unknown, o: { duration: number }) => void;
            currentScreen: HTMLElement;
            onStart?: (triggered: boolean) => void;
          }
        ) => {
          handlerSawOffset = info.offset.x;
          const triggered = info.offset.x > 50;
          api.onStart?.(triggered);
          api.animate(api.currentScreen, { x: triggered ? "100%" : 0 }, { duration: AUTHORED });
          return triggered;
        }
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

  afterEach(() => dom.root.remove());

  // A cancel CLEARS its inline styles once the settle lands, so reading the
  // element afterwards finds nothing. Watch what was written instead.
  const dragThenCancel = async (travel: number) => {
    const written: number[] = [];
    const observer = new MutationObserver(() => {
      const match = /([\d.]+)s/.exec(dom.scope.style.transition);
      if (match) written.push(Number(match[1]));
    });
    observer.observe(dom.scope, { attributes: true, attributeFilter: ["style"] });

    // The gesture's origin is the move that STARTS it, so the drag is measured
    // from ORIGIN and the arming move has to actually move.
    const ORIGIN = 40;
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: ORIGIN }));
    await flush();
    controller.pointerMove(event({ clientX: ORIGIN + travel, timeStamp: 16 }));
    await flush();
    controller.pointerCancel(event({ clientX: ORIGIN + travel, timeStamp: 32 }));
    await flush();

    observer.disconnect();
    return written;
  };

  it("walks the screen home instead of teleporting it", async () => {
    const written = await dragThenCancel(120);

    // A reversal is floored at MIN_REVERSAL_SECONDS; what matters here is that
    // a duration was written at all rather than the zero that snapped.
    expect(written.length).toBeGreaterThan(0);
    expect(Math.max(...written)).toBeGreaterThan(0);
  });

  it("still refuses to read the cancel as a commit", async () => {
    await dragThenCancel(120);

    // The handler sees the neutral sample, so 120px past its own 50px
    // threshold cannot commit a navigation the browser just interrupted.
    expect(handlerSawOffset).toBe(0);
    expect(config.back).not.toHaveBeenCalled();
  });

  it("keeps a genuine tap instantaneous", async () => {
    // Sub-slop: no gesture happened, and a settle animation here would fight
    // the navigation the same tap triggers.
    const written = await dragThenCancel(3);

    expect(written.filter((s) => s > 0)).toHaveLength(0);
  });
});

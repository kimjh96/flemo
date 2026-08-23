import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

// A GESTURE MUST NOT BE ABLE TO OUTLIVE ITS POINTER.
//
// While a swipe is armed the controller asks the binding to preventDefault
// every touchmove on the screen — that is how a drag stops fighting native
// scrolling. It is also the only thing in the library that can stop a screen
// from scrolling at all, so the flag has to come down no matter how the gesture
// ends.
//
// It used to have exactly one way down: a pointerup or pointercancel carrying
// the id that armed it. If the browser never sent that event the screen was
// dead — and `pointerDown`, the one other place that clears the flag, stood
// aside precisely BECAUSE a gesture was active, so no later touch could
// recover it either. Device-reported on Safari, which drops the remaining
// pointer events when the element holding capture is removed or hidden;
// Blink retargets them to the document and recovers on its own.
//
// Three ways out now, one per way the pointer can vanish:
//   - the next primary pointer down (proof no other pointer is down),
//   - `lostpointercapture` (the element went out from under the gesture),
//   - the binding's `abandon()` (the screen unmounted or froze).

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

  return { root, scope, screenContainer, prevScope };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({
    clientX: 0,
    clientY: 0,
    timeStamp: 0,
    pointerId: 1,
    isPrimary: true,
    ...over
  }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("a gesture whose pointer never comes back", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;

  const buildConfig = (): SwipeControllerConfig => ({
    getTransition: () =>
      ({
        name: "stuck-gesture-test",
        initial: { x: "100%" },
        variants: {} as Transition["variants"],
        swipeDirection: "x",
        onSwipeStart: vi.fn(async () => true),
        onSwipe: vi.fn(() => 0),
        onSwipeEnd: vi.fn(
          async (_event: unknown, _info: unknown, api: { onStart?: (t: boolean) => void }) => {
            api.onStart?.(false);
            return false;
          }
        )
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
    setDragStatus: vi.fn(),
    back: vi.fn()
  });

  /** Arm a drag and then lose its pointer, the way the device does. */
  const armAndStrand = async (pointerId = 1) => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope, pointerId }));
    controller.pointerMove(event({ clientX: 40, pointerId }));
    await flush();
    // No pointerup, no pointercancel: the element went away under the finger.
    expect(controller.shouldPreventTouch(), "the drag must actually be armed").toBe(true);
    return controller;
  };

  beforeEach(() => {
    dom = buildDom();
    config = buildConfig();
  });

  afterEach(() => {
    dom.root.remove();
  });

  it("lets the next primary pointer take the screen back", async () => {
    const controller = await armAndStrand();

    // A different pointer id, because the browser never closed the first one.
    controller.pointerDown(event({ target: dom.scope, pointerId: 2 }));

    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("scrolls again after the recovery, rather than merely unlatching", async () => {
    const controller = await armAndStrand();
    controller.pointerDown(event({ target: dom.scope, pointerId: 2 }));

    // The recovering pointer is a plain vertical scroll: it must stay native.
    controller.pointerMove(event({ clientX: 0, clientY: 60, pointerId: 2 }));
    await flush();
    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("still refuses a SECOND finger, which is not proof of anything", async () => {
    const controller = await armAndStrand();

    // isPrimary false means the first finger is still down — the gesture it
    // armed is alive, and a second finger must not tear it down.
    controller.pointerDown(event({ target: dom.scope, pointerId: 2, isPrimary: false }));

    expect(controller.shouldPreventTouch()).toBe(true);
  });

  it("recovers on lostpointercapture — the element went out from under it", async () => {
    const controller = await armAndStrand();

    controller.lostPointerCapture(event({ pointerId: 1, target: dom.scope }));

    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("ignores the capture TRANSFER that starting a touch gesture performs", async () => {
    // A touch pointer is given implicit capture on whatever element it landed
    // on — a child, in any real screen. beginSwipe then captures it onto the
    // scope, and that transfer fires `lostpointercapture` on the CHILD, which
    // bubbles to the scope where the binding listens. Reacting to it cancels
    // the gesture on its first frame: every touch swipe dies.
    //
    // Nothing cheaper than a real touch device sees this. A mouse gets no
    // implicit capture, so there is no transfer and no event — mouse-driven
    // tests and headless probes all pass. jsdom has no pointer capture at all.
    const child = document.createElement("div");
    dom.scope.appendChild(child);
    const controller = await armAndStrand();

    controller.lostPointerCapture(event({ pointerId: 1, target: child }));

    // Still the gesture's own: it was set up, not torn down.
    expect(controller.shouldPreventTouch()).toBe(true);
  });

  it("ignores a lostpointercapture for some other pointer", async () => {
    const controller = await armAndStrand();

    controller.lostPointerCapture(event({ pointerId: 7 }));

    expect(controller.shouldPreventTouch()).toBe(true);
  });

  it("recovers when the binding abandons it — the screen unmounted or froze", async () => {
    const controller = await armAndStrand();

    controller.abandon();

    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("abandons an intent that never became a drag, too", () => {
    // Armed at pointerdown, before any movement resolved the stream: the
    // controller owns `activePointerId` but not capture, and that half-state
    // must not survive the screen either.
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));

    controller.abandon();

    // A pointermove from the vanished pointer finds nothing to resume.
    controller.pointerMove(event({ clientX: 40 }));
    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("is safe to abandon when there was never a gesture", () => {
    const controller = createSwipeController(config);
    expect(() => controller.abandon()).not.toThrow();
    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("survives being abandoned twice", async () => {
    const controller = await armAndStrand();
    controller.abandon();
    expect(() => controller.abandon()).not.toThrow();
    expect(controller.shouldPreventTouch()).toBe(false);
  });

  it("returns dragStatus to IDLE, or every later swipe is blocked", async () => {
    // The recovery has to leave the binding's readiness gate OPEN. A gesture
    // torn down without returning dragStatus to IDLE would trade a dead scroll
    // for a dead swipe — every later drag refused by the gate, which is the
    // same class of defect wearing the other symptom.
    const setDragStatus = config.setDragStatus as ReturnType<typeof vi.fn>;
    const controller = await armAndStrand();
    setDragStatus.mockClear();

    controller.abandon();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(setDragStatus.mock.calls.map((call) => call[0])).toContain("IDLE");
  });

  it("takes a whole new gesture after a recovery", async () => {
    const controller = await armAndStrand();
    controller.abandon();

    const started = createSwipeController(config);
    void started;
    controller.pointerDown(event({ target: dom.scope, pointerId: 3 }));
    controller.pointerMove(event({ clientX: 40, pointerId: 3 }));
    await flush();

    // Armed again: the recovery restored a working controller, not a dead one.
    expect(controller.shouldPreventTouch()).toBe(true);
  });
});

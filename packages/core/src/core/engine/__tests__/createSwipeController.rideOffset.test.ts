import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { fullVariants } from "./variantStub";

// The drag half of the ride-along percentage problem. The compiled path hands a
// shared bar its own `@keyframes`; a drag hands it inline styles, written by the
// controller in the same tick it writes the screen's. Both roads carried the
// same defect: material's release writes `y: "100%"`, which on the screen means
// a whole viewport and on a 104px bar means 104px (see rideOffset.ts).
//
// <Layer> riders stay verbatim on purpose: a slot is `inset: 0` on the
// OUTERMOST screen, which is already the basis its percentage is written
// against, so resolving it against a nested screen's height would newly break
// what works today.
function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");
  prevScreenContainer.appendChild(prevScope);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute("data-flemo-screen", "");
  const topBar = document.createElement("div");
  topBar.setAttribute("data-flemo-bar", "app");
  // A <Layer> host rides the same flight down the same code path, and is the
  // control for the exclusion above: its box is the screen's, so it must keep
  // the authored percentage.
  const layerHost = document.createElement("div");
  layerHost.setAttribute("data-flemo-layer-host", "");
  screenContainer.append(scope, topBar, layerHost);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();
  // jsdom has no layout. This is the screen box the controller reads once per
  // gesture, standing in for what publishRideBox measures in a browser.
  scope.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 588,
      height: 770,
      right: 588,
      bottom: 770,
      toJSON: () => ({})
    }) as DOMRect;

  return { root, scope, screenContainer, topBar, layerHost };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

type SwipeAnimateLike = (
  target: HTMLElement,
  value: Record<string, unknown>,
  options: Record<string, unknown>
) => Promise<void>;

describe("createSwipeController ride offsets", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  // Read INSIDE the release: a swipe that does not commit clears every inline
  // value it wrote before the gesture returns.
  let atRelease: { scope: string; bar: string; layerHost: string } | null;
  let releaseValue: Record<string, unknown>;

  const drag = async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope, clientX: 100, clientY: 0 }));
    for (const clientY of [40, 200]) {
      controller.pointerMove(event({ clientX: 100, clientY }));
      await flush();
    }
    controller.pointerUp(event({ clientX: 100, clientY: 200 }));
    await flush();
  };

  beforeEach(() => {
    dom = buildDom();
    atRelease = null;
    releaseValue = { y: "100%" };
    const transition = {
      name: "ride-test",
      initial: { y: "100%" },
      variants: fullVariants({ x: 0 }, { duration: 0.3 }),
      swipeDirection: "y",
      onSwipeStart: async () => true,
      onSwipe: () => 0,
      onSwipeEnd: async (
        _: unknown,
        __: unknown,
        { animate, currentScreen }: { animate: SwipeAnimateLike; currentScreen: HTMLElement }
      ) => {
        await animate(currentScreen, releaseValue, { duration: 0 });
        atRelease = {
          scope: currentScreen.style.transform,
          bar: dom.topBar.style.transform,
          layerHost: dom.layerHost.style.transform
        };
        return false;
      }
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
      getDecorator: () => undefined,
      getElements: () => ({
        scope: dom.scope,
        screenContainer: dom.screenContainer,
        decorator: null,
        sharedTopBar: dom.topBar,
        sharedBottomBar: null
      }),
      hasSharedTopBar: () => true,
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

  it("mirrors a percentage y to a riding bar as the SCREEN's distance", async () => {
    await drag();

    // The screen keeps the authored percentage against its own box; the bar
    // takes the same distance spelled out, not 100% of its own shorter box.
    expect(atRelease).not.toBeNull();
    expect(atRelease!.scope).toContain("100%");
    expect(atRelease!.bar).toContain("770px");
    expect(atRelease!.bar).not.toContain("100%");
  });

  it("leaves a <Layer> rider on the authored percentage", async () => {
    // The reason the resolution is keyed on a set of bars rather than applied
    // to every rider: a host and a slot are `inset: 0` on the OUTERMOST screen,
    // so the percentage they already carry is measured against the right box,
    // and rewriting it against a nested screen's height would break them.
    await drag();

    expect(atRelease!.layerHost).toContain("100%");
    expect(atRelease!.layerHost).not.toContain("770px");
  });

  it("passes an absolute offset through untouched", async () => {
    releaseValue = { y: -56 };
    await drag();

    expect(atRelease!.scope).toContain("-56px");
    expect(atRelease!.bar).toContain("-56px");
  });

  it("leaves a percentage x alone, since a bar is already the screen's width", async () => {
    releaseValue = { x: "100%" };
    await drag();

    expect(atRelease!.scope).toContain("100%");
    expect(atRelease!.bar).toContain("100%");
  });
});

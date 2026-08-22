import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

// A screen that hosts a NESTED <Router> keeps that router's screens INSIDE its
// own scope. Their decorator and shared bars are therefore DEEPER but EARLIER
// in document order than the hosting screen's own, which a descendant query
// returns first — so a swipe-back drove the inner router's dim while the
// screen's own dim stood still at full opacity for the whole drag. Reported on
// plen's 내 지역 tab, the one page with a nested Router; measured on the device
// build as the outer dim pinned at opacity 1 while the inner one faded
// 0.95 → 0.36 across the drag.
function buildNestedDom() {
  const root = document.createElement("div");

  // Previous screen: scope, and INSIDE it a nested Router's screen container
  // with its own scope + decorator + bar. The screen's own bar and decorator
  // are direct children, rendered after the scope (as the binding renders them).
  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute("data-flemo-screen", "");

  const nestedContainer = document.createElement("div");
  const nestedScope = document.createElement("div");
  nestedScope.setAttribute("data-flemo-screen", "");
  const nestedBar = document.createElement("div");
  nestedBar.setAttribute("data-flemo-bar", "nav");
  const nestedDecorator = document.createElement("div");
  nestedDecorator.setAttribute("data-flemo-decorator", "");
  const nestedPart = document.createElement("div");
  nestedPart.setAttribute("data-flemo-part-name", "inner");
  nestedScope.appendChild(nestedPart);
  nestedContainer.append(nestedScope, nestedBar, nestedDecorator);
  prevScope.appendChild(nestedContainer);

  const ownPart = document.createElement("div");
  ownPart.setAttribute("data-flemo-part-name", "outer");
  prevScope.appendChild(ownPart);

  const prevBar = document.createElement("div");
  prevBar.setAttribute("data-flemo-bar", "nav");
  const barPart = document.createElement("div");
  barPart.setAttribute("data-flemo-part-name", "bar");
  prevBar.appendChild(barPart);
  const prevDecorator = document.createElement("div");
  prevDecorator.setAttribute("data-flemo-decorator", "");
  prevScreenContainer.append(prevScope, prevBar, prevDecorator);

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

  return {
    root,
    scope,
    decorator,
    screenContainer,
    prevScope,
    prevBar,
    prevDecorator,
    nestedScope,
    nestedBar,
    nestedDecorator,
    parts: { own: ownPart, bar: barPart, nested: nestedPart }
  };
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

describe("swipe-back on a screen that hosts a nested Router", () => {
  let dom: ReturnType<typeof buildNestedDom>;
  let seen: { prevScreen?: HTMLElement; prevDecorator?: HTMLElement; parts: string[] };
  let config: SwipeControllerConfig;

  beforeEach(() => {
    dom = buildNestedDom();
    seen = { parts: [] };

    const transition = {
      name: "swipe-nested",
      initial: { x: "100%" },
      variants: {} as Transition["variants"],
      swipeDirection: "x",
      onSwipeStart: async (
        _event: PointerEvent,
        _info: unknown,
        api: {
          prevScreen: HTMLElement;
          onStart: (triggered: boolean) => void;
        }
      ) => {
        seen.prevScreen = api.prevScreen;
        api.onStart(true);
        return true;
      },
      onSwipe: () => 0,
      onSwipeEnd: async () => false
    } as unknown as Transition;

    config = {
      getTransition: () => transition,
      getDecorator: () =>
        ({
          name: "overlay",
          // A real decorator carries initial/variants; the controller now
          // promotes it for the drag, which reads them.
          initial: { opacity: 0 },
          variants: {},
          onSwipeStart: (_triggered: boolean, api: { prevDecorator: HTMLElement }) => {
            seen.prevDecorator = api.prevDecorator;
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

  const drag = async () => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: 40 }));
    await flush();
  };

  it("drives the screen's OWN decorator, not the inner router's", async () => {
    await drag();

    expect(seen.prevDecorator).toBe(dom.prevDecorator);
    expect(seen.prevDecorator).not.toBe(dom.nestedDecorator);
  });

  it("reveals the screen's own scope, not the inner router's", async () => {
    await drag();

    expect(seen.prevScreen).toBe(dom.prevScope);
    expect(seen.prevScreen).not.toBe(dom.nestedScope);
  });
});

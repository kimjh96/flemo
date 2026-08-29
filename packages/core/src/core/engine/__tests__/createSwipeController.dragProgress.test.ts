import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import cupertino from "@transition/cupertino";
import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";
import { partTransitionMap } from "@transition/partTransition/partTransition";

import { fullVariants } from "./variantStub";

// WHAT "HOW FAR ALONG" MEANS, and who gets to answer it.
//
// A decorator's and a part's swipe hooks are documented to receive the drag
// progress as 0-100. They used to receive whatever the TRANSITION passed to
// `onProgress`, which is the author's own number in the author's own unit, so
// the answer depended on which preset the decorator happened to be paired
// with. The controller measures the drag against the box the screen is
// actually dragged over, which is the only place that question can be answered
// for every transition at once.
//
// The case that exposed it: a nested Router inside a phone-shaped stage. The
// screen is ~348px wide while the window is ~1275px, so cupertino's
// window-normalized progress reported 12% where the screen had covered 45%,
// and the dim over the previous screen barely lifted across a whole drag.

const SCREEN_SPAN = 348;

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
  part.setAttribute("data-flemo-part-name", "progress-part");
  scope.appendChild(part);
  const decorator = document.createElement("div");
  decorator.setAttribute("data-flemo-decorator", "");
  screenContainer.append(scope, decorator);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  // A CONTAINED Router: the screen is far narrower than the window, which is
  // the whole point of the case.
  scope.getBoundingClientRect = () =>
    ({ width: SCREEN_SPAN, height: 700, top: 0, left: 0 }) as DOMRect;

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, decorator, screenContainer, prevScope, prevDecorator, part };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("the drag's progress", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  let seenDecorator: number[];
  let seenPart: number[];
  let seenMorph: number[];

  beforeEach(() => {
    dom = buildDom();
    seenDecorator = [];
    seenPart = [];
    seenMorph = [];

    partTransitionMap.set("progress-part", {
      name: "progress-part",
      onSwipe: (_t: boolean, progress: number) => {
        seenPart.push(progress);
      }
    } as never);

    config = {
      getTransition: () => cupertino as Transition,
      getDecorator: () =>
        ({
          name: "progress-dim",
          initial: { opacity: 0 },
          variants: fullVariants({ opacity: 1 }),
          onSwipe: (_t: boolean, progress: number) => {
            seenDecorator.push(progress);
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
      back: vi.fn(),
      onDragProgress: (progress) => {
        seenMorph.push(progress);
      }
    };
  });

  afterEach(() => {
    dom.root.remove();
    partTransitionMap.delete("progress-part");
  });

  // The gesture's origin is the move that STARTS it, not the pointerdown, so
  // `travel` is measured from there.
  const ORIGIN = 40;
  const dragBy = async (travel: number) => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope }));
    controller.pointerMove(event({ clientX: ORIGIN }));
    await flush();
    controller.pointerMove(event({ clientX: ORIGIN + travel, timeStamp: 16 }));
    await flush();
  };

  it("measures the decorator's progress against the SCREEN, not the window", async () => {
    // Half the screen. Against the window this would have read as 12%.
    await dragBy(SCREEN_SPAN / 2);

    expect(window.innerWidth).toBeGreaterThan(SCREEN_SPAN);
    expect(seenDecorator.at(-1)).toBeCloseTo(50, 5);
  });

  it("hands a part the same number", async () => {
    await dragBy(SCREEN_SPAN / 2);

    expect(seenPart.at(-1)).toBeCloseTo(50, 5);
  });

  it("agrees with the number the morph runtime already received", async () => {
    await dragBy(SCREEN_SPAN / 2);

    // One span, read once: the morph's 0-1 and the hooks' 0-100 are the same
    // measurement in two units, which is what stops a shared element and a dim
    // from disagreeing about where the finger is.
    expect(seenMorph.at(-1)! * 100).toBeCloseTo(seenDecorator.at(-1)!, 5);
  });

  it("clamps past the screen's own width instead of running past 100", async () => {
    await dragBy(SCREEN_SPAN * 2);

    expect(seenDecorator.at(-1)).toBe(100);
  });
});

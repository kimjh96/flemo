import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

import { BAR_ATTR, LAYER_HOST_ATTR, SCREEN_ATTR } from "@dom/attributes";

import { fullVariants } from "./variantStub";

// A DIRECTION IS A COMPLETE SWIPE.
//
// A transition that writes no hook has its drag driven from its own pop
// keyframes: the controller stages them when the finger lands, moves them with
// the gesture, and hands them back on release. This is the path the hook-based
// suites never reach, because their stubs all declare `onSwipe`.
//
// WHAT IT IS FOR is measured, not aesthetic. A drag written value-at-a-time is
// not an animation as far as the compositor is concerned, so the RELEASE was
// the first commit of one — 41-49ms of dropped frames on an iPhone, with the
// main thread demonstrably idle across it, on every release regardless of how
// fast the gesture was. Staging at drag start is what removes it.

const ANIMATED: { element: HTMLElement; keyframes: Keyframe[] }[] = [];
const CANCELLED: HTMLElement[] = [];

const stubAnimate = (element: HTMLElement) => {
  element.animate = ((keyframes: Keyframe[]) => {
    ANIMATED.push({ element, keyframes });
    const animation = {
      currentTime: 0,
      startTime: 0,
      playbackRate: 1,
      timeline: { currentTime: 0 },
      pause: vi.fn(),
      play: vi.fn(),
      cancel: vi.fn(() => CANCELLED.push(element)),
      // jsdom runs no animation, so a staged one would never finish and the
      // release would wait out its backstop. Land on the next microtask
      // instead: what these cases are about is the ORDER of the landing and
      // the commit, not how long the landing takes.
      addEventListener: (type: string, listener: () => void) => {
        if (type === "finish") queueMicrotask(listener);
      }
    } as unknown as Animation;
    return animation;
  }) as HTMLElement["animate"];
};

function buildDom() {
  const root = document.createElement("div");

  const prevScreenContainer = document.createElement("div");
  const prevScope = document.createElement("div");
  prevScope.setAttribute(SCREEN_ATTR, "prev-1");
  const prevBar = document.createElement("div");
  prevBar.setAttribute(BAR_ATTR, "nav");
  prevScreenContainer.append(prevScope, prevBar);

  const screenContainer = document.createElement("div");
  const scope = document.createElement("div");
  scope.setAttribute(SCREEN_ATTR, "top-1");
  const bar = document.createElement("div");
  bar.setAttribute(BAR_ATTR, "nav");
  // A <Layer> host beside the scope. It is the one rider that is not a bar,
  // and it takes the screen's values verbatim rather than resolved against the
  // screen box: a slot's box IS the screen's (see rideOffset.ts).
  const layerHost = document.createElement("div");
  layerHost.setAttribute(LAYER_HOST_ATTR, "true");
  screenContainer.append(scope, bar, layerHost);

  root.append(prevScreenContainer, screenContainer);
  document.body.appendChild(root);

  for (const element of [scope, bar, layerHost, prevScope, prevBar]) stubAnimate(element);

  scope.setPointerCapture = vi.fn();
  scope.hasPointerCapture = vi.fn(() => true);
  scope.releasePointerCapture = vi.fn();

  return { root, scope, bar, layerHost, screenContainer, prevScope, prevBar };
}

const event = (over: Partial<PointerEvent> & { target?: EventTarget }) =>
  ({ clientX: 0, clientY: 0, timeStamp: 0, pointerId: 1, ...over }) as unknown as PointerEvent;

const flush = () =>
  new Promise((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0));
  });

describe("a swipe declared with nothing but a direction", () => {
  let dom: ReturnType<typeof buildDom>;

  // A pop that actually goes somewhere: the dragged screen leaves across its
  // own width, which is what the drag walks and what the landing has to hold.
  const declared = (overrides: Record<string, unknown> = {}) =>
    ({
      name: "declared-swipe-test",
      initial: { x: "100%" },
      variants: {
        ...fullVariants({ x: 0 }, { duration: 0.7 }),
        "POPPING-true": { value: { x: "100%" }, options: { duration: 0.7 } }
      },
      swipe: { direction: "x", ...overrides }
    }) as unknown as Transition;

  const buildConfig = (transition: Transition): SwipeControllerConfig => ({
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
  });

  const drag = async (controller: ReturnType<typeof createSwipeController>, to: number[]) => {
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    for (const clientX of to) {
      controller.pointerMove(event({ clientX, clientY: 100 }));
      await flush();
    }
  };

  beforeEach(() => {
    ANIMATED.length = 0;
    CANCELLED.length = 0;
    dom = buildDom();
  });

  afterEach(() => {
    dom.root.remove();
  });

  it("stages the screens as animations when the finger lands, not on release", async () => {
    const controller = createSwipeController(buildConfig(declared()));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    // Both screens, before a single follow frame has run — and the overlay
    // riding the dragged one, in the same call and from the same variant, so
    // it cannot end up on a different clock from the screen it belongs to.
    expect(ANIMATED.map((entry) => entry.element)).toContain(dom.scope);
    expect(ANIMATED.map((entry) => entry.element)).toContain(dom.prevScope);
    expect(ANIMATED.map((entry) => entry.element)).toContain(dom.layerHost);
  });

  it("writes no inline transform, because the animation owns the screens", async () => {
    const controller = createSwipeController(buildConfig(declared()));
    await drag(controller, [120, 200]);

    // The defect a second driver would cause is a bar drifting from the screen
    // it rides, so neither may be written to by hand.
    expect(dom.scope.style.transform).toBe("");
    expect(dom.prevScope.style.transform).toBe("");
  });

  it("hands the same animation back on release rather than starting one", async () => {
    const controller = createSwipeController(buildConfig(declared()));
    await drag(controller, [120, 200]);
    const stagedByRelease = ANIMATED.length;

    controller.pointerUp(event({ clientX: 200, clientY: 100 }));
    await flush();

    // Nothing new is animated at the release: the settle is the staged
    // animation played on, which is the whole point of staging it.
    expect(ANIMATED.length).toBe(stagedByRelease);
  });

  it("commits past the default distance and returns under it", async () => {
    const back = vi.fn();
    const near = createSwipeController({ ...buildConfig(declared()), back });
    // Under the shared default (50px on a 390px screen) and released with no
    // speed: the gesture has not earned the navigation.
    near.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    near.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    near.pointerMove(event({ clientX: 45, clientY: 100, timeStamp: 400 }));
    await flush();
    near.pointerUp(event({ clientX: 45, clientY: 100, timeStamp: 800 }));
    await flush();
    expect(back).not.toHaveBeenCalled();

    dom.root.remove();
    dom = buildDom();
    const far = vi.fn();
    const across = createSwipeController({ ...buildConfig(declared()), back: far });
    await drag(across, [200, 300]);
    across.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();
    expect(far).toHaveBeenCalledTimes(1);
  });

  it("does not commit until the landing has landed", async () => {
    // DEVICE-REPORTED. A transition that wrote `onEnd` awaited its own screens
    // inside it, so the navigation only committed once they were home. The
    // declarative path had nothing to await and committed at once, which
    // unmounts the screen while it is still flying: it vanishes instead of
    // leaving.
    const order: string[] = [];
    const controller = createSwipeController({
      ...buildConfig(declared()),
      back: () => order.push("commit")
    });
    await drag(controller, [200, 300]);

    // The staged animations land on a microtask (see the stub), so anything
    // that waits for them is ordered after this.
    queueMicrotask(() => order.push("landed"));
    controller.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();

    expect(order).toEqual(["landed", "commit"]);
  });

  it("leaves both screens their landed pose, not their rest style", async () => {
    // DEVICE-REPORTED, twice. Cancelling a landed animation returns the element
    // to its own rest style, and for the screen that just flew out that style
    // is where it started: it blinked back into view for the frames between the
    // landing and the unmount. Holding the animation's fill instead was the
    // first attempt and WebKit did not honour it, so the pose is written
    // inline — a basis that does not depend on a finished animation at all.
    const controller = createSwipeController(buildConfig(declared()));
    await drag(controller, [200, 300]);
    controller.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();

    // Its own keyframe's end, on the element, in a form nothing can drop.
    expect(dom.scope.style.transform).toContain("100%");

    // AND THE SCREEN THAT CAME HOME, for the same reason. Its rest style is
    // not where the gesture left it either: a covered screen rests at the
    // parallax the pop was supposed to take it out of, so cancelling dropped
    // it 30% of a width backwards for the frames before the stack re-rendered
    // it as the active one. Measured on the bench at -117px.
    expect(dom.prevScope.style.transform).not.toBe("");
    // The animations themselves are released, so neither can outrank the next
    // flight's own keyframe.
    expect(CANCELLED).toContain(dom.scope);
    expect(CANCELLED).toContain(dom.prevScope);
  });

  it("takes the distance a transition names instead of the default", async () => {
    const back = vi.fn();
    const controller = createSwipeController({
      ...buildConfig(declared({ threshold: 1000 })),
      back
    });
    await drag(controller, [200, 300]);
    controller.pointerUp(event({ clientX: 300, clientY: 100, timeStamp: 9000 }));
    await flush();

    // Well past the default, nowhere near this transition's own.
    expect(back).not.toHaveBeenCalled();
  });

  it("refuses a hook's own write to anything the scrub is holding", async () => {
    // A transition may keep `onStart` and still let flemo drive — it only
    // answers whether the gesture may begin. So it is handed `animate`, and
    // what it writes with it must not reach the screens or the bars riding
    // them: two drivers on one transform is exactly how a bar drifts from the
    // screen it rides.
    // A bar rides when the partner screen does not own the same one, so give
    // the two screens' bars different ids and both sides ride.
    dom.prevBar.setAttribute("data-flemo-bar-id", "prev-nav");
    const base = buildConfig(
      declared({
        onStart: async (
          _event: PointerEvent,
          _info: unknown,
          { animate }: { animate: (el: HTMLElement, value: unknown) => Promise<void> }
        ) => {
          for (const element of [dom.scope, dom.prevScope, dom.bar, dom.prevBar]) {
            await animate(element, { x: 999 });
          }
          return true;
        }
      })
    );
    const controller = createSwipeController({
      ...base,
      getElements: () => ({ ...base.getElements(), sharedBottomBar: dom.bar }),
      hasSharedBottomBar: () => true,
      getSharedBottomBarId: () => "current-nav"
    });
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    for (const element of [dom.scope, dom.prevScope, dom.bar, dom.prevBar]) {
      expect(element.style.transform).toBe("");
    }
  });

  it("holds nothing, and so refuses nothing, when the pop animates nothing", async () => {
    // A transition may declare a swipe over a pop with no animatable target.
    // There is then nothing to stage and nothing to walk, and the gesture must
    // not end up owning screens it is not moving: a hook it still holds would
    // have its writes swallowed by a scrub made of nulls.
    const stationary = {
      name: "declared-swipe-stationary",
      initial: {},
      variants: fullVariants({}),
      swipe: {
        direction: "x",
        onStart: async (
          _event: PointerEvent,
          _info: unknown,
          { animate }: { animate: (el: HTMLElement, value: unknown) => Promise<void> }
        ) => {
          await animate(dom.scope, { x: 12 });
          return true;
        }
      }
    } as unknown as Transition;

    const committed = vi.fn();
    const controller = createSwipeController({ ...buildConfig(stationary), back: committed });
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    expect(ANIMATED).toHaveLength(0);
    expect(dom.scope.style.transform).toContain("12");

    // And the release still decides, on a clock with no authored ceiling to
    // shorten: there is no pop motion to read one from.
    controller.pointerMove(event({ clientX: 300, clientY: 100 }));
    await flush();
    controller.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();
    expect(committed).toHaveBeenCalledTimes(1);
  });

  it("returns the screens and commits nothing when the browser takes the pointer", async () => {
    // A forced cancel is not a verdict the gesture earned: however far it had
    // travelled, the release goes back rather than through.
    const back = vi.fn();
    const controller = createSwipeController({ ...buildConfig(declared()), back });
    await drag(controller, [200, 300]);

    controller.pointerCancel(event({ clientX: 300, clientY: 100 }));
    await flush();

    expect(back).not.toHaveBeenCalled();
    // Handed back all the same, so the next flight's own keyframe outranks
    // nothing left behind here.
    expect(CANCELLED).toContain(dom.scope);
    expect(CANCELLED).toContain(dom.prevScope);
  });

  it("ignores a follow frame for a transition that declares no swipe", async () => {
    // The binding forwards pointer events for whatever is on screen, so a
    // transition with no gesture has to be a no-op here rather than a throw.
    const still = {
      name: "declared-swipe-none",
      initial: {},
      variants: fullVariants({ x: 0 })
    } as unknown as Transition;

    const controller = createSwipeController(buildConfig(still));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();
    controller.pointerMove(event({ clientX: 200, clientY: 100 }));
    await flush();

    expect(ANIMATED).toHaveLength(0);
    expect(dom.scope.style.transform).toBe("");
  });

  it("walks the drag's own destination when the transition names one", async () => {
    // THE CASE THAT USED TO NEED HOOKS. A drag that goes somewhere other than
    // the pop differs in SHAPE rather than rate, so `progress` cannot express
    // it, and before this the only way to author one was to take over `onMove`
    // and pay the release's first animation commit for the whole gesture.
    const controller = createSwipeController(
      buildConfig(declared({ current: { x: "40%" }, prev: {} }))
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    const staged = ANIMATED.find((entry) => entry.element === dom.scope);
    // Its own end, not the pop's `100%`.
    expect(JSON.stringify(staged?.keyframes)).toContain("40%");
    expect(JSON.stringify(staged?.keyframes)).not.toContain("100%");

    // An empty destination is a side that does not move, and it is not staged
    // at all rather than staged against a pose it will never reach.
    expect(ANIMATED.map((entry) => entry.element)).not.toContain(dom.prevScope);
  });

  it("passes through the stops a drag names, so two properties can differ", async () => {
    // THE LAST THING THAT NEEDED A HOOK. One progress walks one keyframe, so a
    // single destination makes every property travel at one rate. A drag whose
    // opacity is spent a third of the way across while it keeps sliding for
    // the rest says where that third is, and the two rates coexist.
    const controller = createSwipeController(
      buildConfig(
        declared({
          current: [
            { at: 0.3, value: { x: "30%", opacity: 0 } },
            { value: { x: "100%", opacity: 0 } }
          ],
          prev: {}
        })
      )
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    const staged = ANIMATED.find((entry) => entry.element === dom.scope);
    expect(staged?.keyframes).toHaveLength(3);
    // Only the stop is placed; the ends are where WAAPI already puts them.
    expect(staged?.keyframes[0]!.offset).toBeUndefined();
    expect(staged?.keyframes[1]!.offset).toBe(0.3);
    expect(staged?.keyframes[2]!.offset).toBeUndefined();
    // The opacity is done at the stop and holds; the transform keeps going.
    expect(staged?.keyframes[1]!.opacity).toBe("0");
    expect(staged?.keyframes[2]!.opacity).toBe("0");
    expect(JSON.stringify(staged?.keyframes[1])).toContain("30%");
    expect(JSON.stringify(staged?.keyframes[2])).toContain("100%");
  });

  it("takes the last stop as the landed pose, not the first", async () => {
    const controller = createSwipeController(
      buildConfig(
        declared({
          current: [{ at: 0.3, value: { x: "30%" } }, { value: { x: "80%" } }],
          prev: {}
        })
      )
    );
    await drag(controller, [200, 300]);
    controller.pointerUp(event({ clientX: 300, clientY: 100 }));
    await flush();

    // The pose written inline on the commit is where the drag ENDS.
    expect(dom.scope.style.transform).toContain("80%");
  });

  it("carries the stops onto the bars riding that screen", async () => {
    // A bar that rides a screen has to pass through the SAME poses it does,
    // resolved against the screen's box rather than its own: a bar left on the
    // two ends while its screen goes via a third pose is the drift this whole
    // staging exists to make impossible.
    const controller = createSwipeController(
      buildConfig(
        declared({
          prev: [{ at: 0.4, value: { y: "40%" } }, { value: { y: 0 } }]
        })
      )
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    const bar = ANIMATED.find((entry) => entry.element === dom.prevBar);
    expect(bar?.keyframes).toHaveLength(3);
    expect(bar?.keyframes[1]!.offset).toBe(0.4);
  });

  it("spaces a stop that names no place, as a keyframe does", async () => {
    const controller = createSwipeController(
      buildConfig(
        declared({ current: [{ value: { x: "20%" } }, { value: { x: "100%" } }], prev: {} })
      )
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    const staged = ANIMATED.find((entry) => entry.element === dom.scope);
    // Placed at zero rather than left undefined, so a stop is never silently
    // moved by how many others happen to be beside it.
    expect(staged?.keyframes[1]!.offset).toBe(0);
  });

  it("stages a drag whose pop animates nothing, on a clock of zero", async () => {
    // The destination is the drag's, and the pop has none to lend a duration.
    const stationary = {
      name: "declared-swipe-no-pop-clock",
      initial: {},
      variants: fullVariants({}),
      swipe: { direction: "x", current: { x: "100%" } }
    } as unknown as Transition;

    const controller = createSwipeController(buildConfig(stationary));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    // Nothing is staged: a rider with no duration has no clock to scrub.
    expect(ANIMATED).toHaveLength(0);
  });

  it("keeps the pop's destination for a transition that names none", async () => {
    const controller = createSwipeController(buildConfig(declared()));
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    const staged = ANIMATED.find((entry) => entry.element === dom.scope);
    expect(JSON.stringify(staged?.keyframes)).toContain("100%");
  });

  it("keeps the screens for a transition that named them and still writes a hook", async () => {
    // THE COMPOSITION HOOKS EXIST FOR. A gesture that carries a morphing
    // element about freely needs a hook for the element, and no reason to hand
    // over the screens for it — they are the expensive half, two full-screen
    // layers, and the release's cost is measured in what the main thread was
    // holding.
    const loose = document.createElement("div");
    dom.screenContainer.appendChild(loose);
    stubAnimate(loose);

    const controller = createSwipeController(
      buildConfig(
        declared({
          current: { x: "100%" },
          prev: {},
          onMove: (
            _event: PointerEvent,
            _info: unknown,
            { animate }: { animate: (el: HTMLElement, value: unknown, o: unknown) => void }
          ) => {
            // The element the author is carrying, and a screen they are not.
            animate(loose, { x: 12 }, { duration: 0 });
            animate(dom.scope, { x: 999 }, { duration: 0 });
            return 0;
          }
        })
      )
    );
    await drag(controller, [120, 200]);

    // The screens stayed on the scrub, so the hook's write to one was refused.
    expect(ANIMATED.map((entry) => entry.element)).toContain(dom.scope);
    expect(dom.scope.style.transform).toBe("");
    // And everything else it animated went through untouched.
    expect(loose.style.transform).toContain("12");
  });

  it("stands aside for a transition that took the drag over", async () => {
    const onMove = vi.fn(() => 0);
    const controller = createSwipeController(
      buildConfig(
        declared({
          onMove,
          onEnd: async () => false
        })
      )
    );
    controller.pointerDown(event({ target: dom.scope, clientX: 0, clientY: 100 }));
    controller.pointerMove(event({ clientX: 40, clientY: 100 }));
    await flush();

    // Nothing staged: the screens are the transition's for this gesture.
    expect(ANIMATED.map((entry) => entry.element)).not.toContain(dom.scope);
    controller.pointerMove(event({ clientX: 120, clientY: 100 }));
    await flush();
    expect(onMove).toHaveBeenCalled();
  });
});

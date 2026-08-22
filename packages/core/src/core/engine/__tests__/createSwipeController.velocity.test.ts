import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Transition } from "@transition/typing";

import createSwipeController, {
  type SwipeControllerConfig
} from "@core/engine/createSwipeController";

// THE RELEASE DIVIDES BY THIS NUMBER.
//
// A release's length comes from how fast the finger was going, so a single
// mis-measurement is not a rounding error — it is the whole landing. Browsers
// do not deliver pointermove on an even clock: they coalesce, they batch behind
// a busy frame, and one pair spanning 6ms with 12px between them reads 2000px/s
// for a finger travelling at 500.
//
// With 30% of the screen left, an honest 600 px/s asks for a 0.21s settle; a
// spurious 2000 px/s collapses it onto the 0.12s floor. Device-reported on
// Safari against Android: the same gesture, "too whippy" on one of them.

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
  return { root, scope, screenContainer };
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

describe("the release velocity", () => {
  let dom: ReturnType<typeof buildDom>;
  let config: SwipeControllerConfig;
  /** The velocity the transition's release hook was handed. */
  let seen: number;

  beforeEach(() => {
    dom = buildDom();
    seen = Number.NaN;
    config = {
      getTransition: () =>
        ({
          name: "velocity-test",
          initial: { x: "100%" },
          variants: {} as Transition["variants"],
          swipeDirection: "x",
          onSwipeStart: vi.fn(async () => true),
          onSwipe: vi.fn(() => 0),
          onSwipeEnd: vi.fn(
            async (
              _event: unknown,
              info: { velocity: { x: number } },
              api: { onStart?: (t: boolean) => void }
            ) => {
              seen = info.velocity.x;
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
    };
  });

  afterEach(() => dom.root.remove());

  /** Drive a drag from a list of [x, timeStamp] samples and release. */
  const drag = async (samples: [number, number][]) => {
    const controller = createSwipeController(config);
    controller.pointerDown(event({ target: dom.scope, clientX: 0, timeStamp: 0 }));
    for (const [x, t] of samples) {
      controller.pointerMove(event({ clientX: x, timeStamp: t }));
      await flush();
    }
    const last = samples[samples.length - 1]!;
    controller.pointerUp(event({ clientX: last[0], timeStamp: last[1] }));
    await flush();
    return seen;
  };

  it("reads a steady finger at the speed it was actually going", async () => {
    // 500 px/s, sampled every 16ms.
    const samples: [number, number][] = [];
    for (let i = 1; i <= 12; i += 1) samples.push([Math.round(i * 8), i * 16]);
    const velocity = await drag(samples);
    expect(velocity).toBeGreaterThan(400);
    expect(velocity).toBeLessThan(600);
  });

  it("is not fooled by one tight pair at the end of an ordinary drag", async () => {
    // The same 500 px/s finger, but the last two moves land 6ms apart with a
    // coalesced 12px jump between them — 2000 px/s if you read only that pair.
    const samples: [number, number][] = [];
    for (let i = 1; i <= 10; i += 1) samples.push([Math.round(i * 8), i * 16]);
    samples.push([92, 166]);
    samples.push([104, 172]);

    const velocity = await drag(samples);
    // The trend, not the artefact. A last-pair reading would be ~2000.
    expect(velocity).toBeLessThan(1000);
    expect(velocity).toBeGreaterThan(400);
  });

  it("still follows a real flick — the window is a trend, not a brake", async () => {
    // A slow start that turns into a genuine 2000 px/s flick over the last
    // 80ms. The release has to inherit that, or a flick lands like a drag.
    const samples: [number, number][] = [];
    for (let i = 1; i <= 5; i += 1) samples.push([Math.round(i * 4), i * 16]);
    let x = 20;
    for (let i = 1; i <= 5; i += 1) {
      x += 32;
      samples.push([x, 80 + i * 16]);
    }
    const velocity = await drag(samples);
    expect(velocity).toBeGreaterThan(1500);
  });

  it("measures a gesture shorter than the window from what it has", async () => {
    const velocity = await drag([
      [20, 16],
      [40, 32]
    ]);
    expect(Number.isFinite(velocity)).toBe(true);
    expect(velocity).toBeGreaterThan(0);
  });

  it("starts each gesture from a clean trail", async () => {
    // A fast gesture must not lend its speed to the slow one after it.
    const fast: [number, number][] = [];
    for (let i = 1; i <= 6; i += 1) fast.push([i * 40, i * 16]);
    await drag(fast);
    const hot = seen;

    const slow: [number, number][] = [];
    for (let i = 1; i <= 6; i += 1) slow.push([i * 4, i * 16]);
    const cold = await drag(slow);

    expect(hot).toBeGreaterThan(1500);
    expect(cold).toBeLessThan(500);
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { intoLayerSpace, preserveAnimations } from "@dom/staging";

// jsdom has no animation timeline, so the animations are stood in for. What is
// under test is the bookkeeping — which animations are matched across the move
// and what they are seeked to — not the browser's clock.
interface FakeAnimation {
  animationName: string;
  currentTime: number | null;
  effect: { target: Element };
}

const animation = (target: Element, name: string, time: number | null): FakeAnimation => ({
  animationName: name,
  currentTime: time,
  effect: { target }
});

function stubAnimations(root: Element, animations: () => FakeAnimation[]): void {
  (root as unknown as { getAnimations: () => unknown[] }).getAnimations = () => animations();
}

describe("preserveAnimations", () => {
  let root: HTMLElement;
  let child: HTMLElement;
  let destination: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    const origin = document.createElement("div");
    destination = document.createElement("div");
    root = document.createElement("div");
    child = document.createElement("span");
    root.appendChild(child);
    origin.appendChild(root);
    document.body.append(origin, destination);
  });

  it("seeks a descendant's animation back to where the move interrupted it", () => {
    // The browser cancels the animation on removal and starts a fresh one at
    // zero when the node is inserted again — the same name, on the same
    // element, with its clock reset.
    let live = [animation(child, "flemo-part-detail-PUSHING-true", 320)];
    stubAnimations(root, () => live);

    preserveAnimations(root, () => {
      live = [animation(child, "flemo-part-detail-PUSHING-true", 0)];
      destination.appendChild(root);
    });

    expect(root.parentElement).toBe(destination);
    expect(live[0].currentTime).toBe(320);
  });

  it("leaves the root's own animations to the runtime", () => {
    // The travel is written by attachMorph on both sides of the move; seeking
    // it here would fight the author of the flight.
    let live = [animation(root, "flemo-morph-1i-travel", 200)];
    stubAnimations(root, () => live);

    preserveAnimations(root, () => {
      live = [animation(root, "flemo-morph-1i-travel", 0)];
      destination.appendChild(root);
    });

    expect(live[0].currentTime).toBe(0);
  });

  it("does not restore an animation that is not there after the move", () => {
    let live: FakeAnimation[] = [animation(child, "gone", 100)];
    stubAnimations(root, () => live);

    expect(() =>
      preserveAnimations(root, () => {
        live = [];
        destination.appendChild(root);
      })
    ).not.toThrow();
  });

  it("carries only what it can identify on both sides of the move", () => {
    // Everything a subtree can be running at the moment of a re-parent, in one
    // list: a script-driven animation (no `animationName`), an effect with no
    // target, one whose clock is not a number, and the ordinary CSS animation
    // that is the whole point. Only the last is addressed — the rest are not
    // this module's to seek, and it must not throw on any of them.
    const outsider = document.createElement("i");
    document.body.appendChild(outsider);
    let live: FakeAnimation[] = [
      { animationName: "", currentTime: 10, effect: { target: child } } as FakeAnimation,
      { animationName: "no-target", currentTime: 10, effect: null } as unknown as FakeAnimation,
      {
        animationName: "not-an-element",
        currentTime: 10,
        effect: { target: {} }
      } as unknown as FakeAnimation,
      animation(child, "unresolved-clock", null),
      animation(child, "flemo-part-detail-PUSHING-true", 320)
    ];
    stubAnimations(root, () => live);

    preserveAnimations(root, () => {
      live = [
        { animationName: "", currentTime: 0, effect: { target: child } } as FakeAnimation,
        // An element that was never in the subtree the index was built from.
        animation(outsider, "flemo-part-detail-PUSHING-true", 0),
        // A name that had nothing saved for it.
        animation(child, "arrived-late", 0),
        animation(child, "flemo-part-detail-PUSHING-true", 0)
      ];
      destination.appendChild(root);
    });

    expect(live.map((one) => one.currentTime)).toEqual([0, 0, 0, 320]);
  });

  it("skips an animation with no target after the move", () => {
    let live: FakeAnimation[] = [animation(child, "flemo-part-b", 90)];
    stubAnimations(root, () => live);

    preserveAnimations(root, () => {
      live = [
        { animationName: "flemo-part-b", currentTime: 0, effect: null } as unknown as FakeAnimation,
        animation(child, "flemo-part-b", 0)
      ];
      destination.appendChild(root);
    });

    expect(live[1]!.currentTime).toBe(90);
  });

  it("lets a refused seek stand rather than failing the move", () => {
    // An animation whose timeline has not resolved yet rejects the seek.
    // Restarting it is the wrong result, but a thrown error mid-flight would
    // leave the element in the layer.
    let live: FakeAnimation[] = [animation(child, "flemo-part-a", 120)];
    stubAnimations(root, () => live);

    preserveAnimations(root, () => {
      const refusing = {
        animationName: "flemo-part-a",
        effect: { target: child },
        get currentTime() {
          return 0;
        },
        set currentTime(_value: number) {
          throw new Error("no resolved timeline");
        }
      } as unknown as FakeAnimation;
      live = [refusing];
      destination.appendChild(root);
    });

    expect(root.parentElement).toBe(destination);
  });

  it("still performs the move where getAnimations is unavailable", () => {
    preserveAnimations(root, () => destination.appendChild(root));

    expect(root.parentElement).toBe(destination);
  });
});

describe("intoLayerSpace", () => {
  // A staging layer can sit inside a transformed ancestor: a device bezel, a
  // scaled preview. A px it is positioned by is then not a px on the glass, and
  // a flight expressed in viewport coordinates lands somewhere else entirely.
  const layerAt = (measured: Partial<DOMRect>, laidOut: { width: number; height: number }) => {
    const layer = document.createElement("div");
    layer.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        toJSON: () => ({}),
        ...measured
      }) as DOMRect;
    Object.defineProperty(layer, "offsetWidth", { value: laidOut.width });
    Object.defineProperty(layer, "offsetHeight", { value: laidOut.height });
    return layer;
  };

  it("divides out the scale an ancestor applied", () => {
    // Laid out at 200x400, measured at 100x200: a half-scale bezel, offset in
    // the viewport as well.
    const layer = layerAt(
      { left: 10, top: 20, width: 100, height: 200 },
      { width: 200, height: 400 }
    );

    expect(intoLayerSpace({ x: 60, y: 120, width: 50, height: 50 }, layer)).toEqual({
      x: 100,
      y: 200,
      width: 100,
      height: 100
    });
  });

  it("passes a rect straight through an unscaled layer", () => {
    const layer = layerAt(
      { left: 0, top: 0, width: 320, height: 640 },
      { width: 320, height: 640 }
    );

    expect(intoLayerSpace({ x: 16, y: 44, width: 24, height: 24 }, layer)).toEqual({
      x: 16,
      y: 44,
      width: 24,
      height: 24
    });
  });

  it("treats a laid-out layer measuring zero as unscaled rather than collapsing the rect", () => {
    // A layer inside a collapsed or hidden ancestor measures nothing while
    // still reporting its layout size. A scale of 0 would send every staged
    // part to infinity.
    const layer = layerAt({ left: 0, top: 0, width: 0, height: 0 }, { width: 320, height: 640 });

    expect(intoLayerSpace({ x: 16, y: 44, width: 24, height: 24 }, layer)).toEqual({
      x: 16,
      y: 44,
      width: 24,
      height: 24
    });
  });

  it("treats a layer with no laid-out size as unscaled rather than dividing by zero", () => {
    const layer = layerAt({ left: 5, top: 5 }, { width: 0, height: 0 });

    expect(intoLayerSpace({ x: 25, y: 15, width: 10, height: 10 }, layer)).toEqual({
      x: 20,
      y: 10,
      width: 10,
      height: 10
    });
  });
});

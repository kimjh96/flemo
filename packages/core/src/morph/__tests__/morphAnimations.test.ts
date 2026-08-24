import { beforeEach, describe, expect, it } from "vitest";

import { preserveDescendantAnimations } from "@morph/morphAnimations";

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

describe("preserveDescendantAnimations", () => {
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

    preserveDescendantAnimations(root, () => {
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

    preserveDescendantAnimations(root, () => {
      live = [animation(root, "flemo-morph-1i-travel", 0)];
      destination.appendChild(root);
    });

    expect(live[0].currentTime).toBe(0);
  });

  it("does not restore an animation that is not there after the move", () => {
    let live: FakeAnimation[] = [animation(child, "gone", 100)];
    stubAnimations(root, () => live);

    expect(() =>
      preserveDescendantAnimations(root, () => {
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

    preserveDescendantAnimations(root, () => {
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

    preserveDescendantAnimations(root, () => {
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

    preserveDescendantAnimations(root, () => {
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
    preserveDescendantAnimations(root, () => destination.appendChild(root));

    expect(root.parentElement).toBe(destination);
  });
});

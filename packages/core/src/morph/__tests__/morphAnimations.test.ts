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

  it("still performs the move where getAnimations is unavailable", () => {
    preserveDescendantAnimations(root, () => destination.appendChild(root));

    expect(root.parentElement).toBe(destination);
  });
});

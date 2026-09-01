import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { stageBarParts, PART_LAYER_LEVEL } from "@core/engine/barPartStaging";

import {
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  BAR_RIDING_ATTR,
  PART_HOME_ATTR,
  PART_NAME_ATTR,
  PART_STAND_IN_ATTR,
  SCREEN_ATTR
} from "@dom/attributes";

// THE COVERED SIDE'S PARTS COME UP OUT OF THE SCREEN.
//
// Two screens sharing a bar id each render their own copy of it, inside their
// own screen container — an isolated stacking context at the screen's z-index.
// So the covered screen's <Part> runs its half of the cross-fade under the other
// screen's opaque surface, where nothing can see it. Staging lifts it above both
// screens for the flight and puts it back, unchanged, when the flight lands.

const NEXT_FRAME = () => new Promise((resolve) => setTimeout(resolve, 0));

// jsdom lays nothing out: `offsetWidth` is always 0 and every rect is empty.
// Staging reads BOTH — the layout box for the size, and the stand-in's rect for
// the place — so a fixture has to stand in for the layout engine on both.
const stubBox = (
  element: HTMLElement,
  box: { x: number; y: number; width: number; height: number }
) => {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      top: box.y,
      left: box.x,
      right: box.x + box.width,
      bottom: box.y + box.height,
      toJSON: () => ({})
    }) as DOMRect;
  Object.defineProperty(element, "offsetWidth", { value: box.width, configurable: true });
  Object.defineProperty(element, "offsetHeight", { value: box.height, configurable: true });
};

// The stand-in is created by the runtime, so the fixture cannot reach it before
// it is measured. It reports the place its part was in, which is what a laid-out
// document would have given it.
const stubStandInLayout = (box: { x: number; y: number; width: number; height: number }) => {
  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.hasAttribute(PART_STAND_IN_ATTR)) {
      return {
        ...box,
        top: box.y,
        left: box.x,
        right: box.x + box.width,
        bottom: box.y + box.height,
        toJSON: () => ({})
      } as DOMRect;
    }
    return original.call(this);
  };
  return () => {
    Element.prototype.getBoundingClientRect = original;
  };
};

let restoreStandIn: () => void;

let layer: HTMLDivElement;
let scope: HTMLDivElement;
let bar: HTMLDivElement;
let part: HTMLDivElement;

beforeEach(() => {
  layer = document.createElement("div");
  document.body.appendChild(layer);

  scope = document.createElement("div");
  scope.setAttribute(SCREEN_ATTR, "screen-1");
  scope.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.HELD);
  document.body.appendChild(scope);

  bar = document.createElement("div");
  // Matched with the partner's bar: it hands over rather than rides.
  bar.setAttribute(BAR_RIDING_ATTR, "false");
  document.body.appendChild(bar);

  part = document.createElement("div");
  part.setAttribute(PART_NAME_ATTR, "navigationIcon");
  bar.appendChild(part);
  stubBox(part, { x: 16, y: 44, width: 24, height: 24 });
  restoreStandIn = stubStandInLayout({ x: 16, y: 44, width: 24, height: 24 });
});

afterEach(() => {
  restoreStandIn?.();
  document.body.replaceChildren();
  vi.useRealTimers();
});

const stage = (overrides: Partial<Parameters<typeof stageBarParts>[0]> = {}) =>
  stageBarParts({ scope, bars: [bar], layer, strandedMs: 10_000, ...overrides });

describe("stageBarParts", () => {
  it("lifts a matched bar's part into the layer at the rect it occupied", () => {
    const staged = stage();

    expect(staged).not.toBeNull();
    expect(part.parentElement).toBe(layer);
    expect(part.style.position).toBe("absolute");
    expect(part.style.left).toBe("16px");
    expect(part.style.top).toBe("44px");
    expect(part.style.width).toBe("24px");
    expect(part.style.height).toBe("24px");
    // getBoundingClientRect measures the border box, so the staged copy is
    // sized as one; a margin would offset a box that is already positioned.
    expect(part.style.boxSizing).toBe("border-box");
    expect(part.style.margin).toBe("0px");
  });

  it("leaves a stand-in holding the part's place in the bar", () => {
    // A part is part of its bar's layout. Lift it out and the bar loses exactly
    // its width; on a pop that happens to the RETURNING screen, whose bar is the
    // one still on the glass at the landing. Measured on a real flight: the
    // title moved 56px and moved back on release.
    stage();

    const standIn = bar.querySelector<HTMLElement>(`[${PART_STAND_IN_ATTR}]`);
    expect(standIn).not.toBeNull();
    expect(standIn!.style.width).toBe("24px");
    expect(standIn!.style.height).toBe("24px");
    // A flex bar must not be free to size it differently from the part it
    // stands for, and it must not be seen or touched.
    expect(standIn!.style.flex).toBe("0 0 auto");
    expect(standIn!.style.visibility).toBe("hidden");
    expect(standIn!.getAttribute("aria-hidden")).toBe("true");
  });

  it("puts the part back into the stand-in's place, and takes the stand-in away", () => {
    const before = document.createElement("span");
    const after = document.createElement("span");
    bar.insertBefore(before, part);
    bar.appendChild(after);
    const staged = stage();

    staged!.release();

    expect(bar.querySelector(`[${PART_STAND_IN_ATTR}]`)).toBeNull();
    expect([...bar.children]).toEqual([before, part, after]);
  });

  it("takes the stand-in away with the part when the bar has gone", () => {
    const staged = stage();
    const standIn = bar.querySelector<HTMLElement>(`[${PART_STAND_IN_ATTR}]`)!;
    bar.remove();

    staged!.release();

    expect(part.isConnected).toBe(false);
    expect(standIn.isConnected).toBe(false);
  });

  it("marks the staged part with the screen it belongs to", () => {
    // Its ancestry is gone, and every participant query that still has to find
    // it — the layer pin, the settle release, the COMPLETED inline clear — goes
    // through this marker (see flightParticipants.collectScreenParts).
    stage();

    expect(part.getAttribute(PART_HOME_ATTR)).toBe("screen-1");
  });

  it("takes no pointer input and outranks the screens it stages over", () => {
    stage();

    expect(layer.style.pointerEvents).toBe("none");
    expect(layer.style.zIndex).toBe(String(PART_LAYER_LEVEL));
  });

  it("leaves a riding bar's parts where they are", () => {
    // A riding bar travels with its screen because the partner does not own it.
    // There is no second copy to cross-fade with, and lifting its parts out of
    // the motion carrying them would strand them mid-air.
    bar.setAttribute(BAR_RIDING_ATTR, "true");

    expect(stage()).toBeNull();
    expect(part.parentElement).toBe(bar);
  });

  it("stages nothing when the Router published no layer", () => {
    expect(stage({ layer: null })).toBeNull();
    expect(part.parentElement).toBe(bar);
  });

  it("stages nothing for a scope with no screen identity", () => {
    // Without an id to stamp, a staged part would silently drop out of its
    // screen's participant set. Better not to stage it at all.
    scope.removeAttribute(SCREEN_ATTR);

    expect(stage()).toBeNull();
    expect(part.parentElement).toBe(bar);
  });

  it("stages nothing it cannot measure", () => {
    // A covered screen is Activity-hidden once its flight settles, and hidden
    // means display: none — every rect inside it reads 0,0 0x0. Pinning a part
    // at that measurement puts it at the layer's origin with no size, seen on a
    // real swipe as the returning screen's icon and badge drawn clipped into
    // the top-left corner.
    stubBox(part, { x: 0, y: 0, width: 0, height: 0 });

    expect(stage()).toBeNull();
    expect(part.parentElement).toBe(bar);
    expect(bar.querySelector(`[${PART_STAND_IN_ATTR}]`)).toBeNull();
  });

  it("stages the measurable parts and leaves the rest at home", () => {
    const hidden = document.createElement("div");
    hidden.setAttribute(PART_NAME_ATTR, "progress");
    bar.appendChild(hidden);
    stubBox(hidden, { x: 0, y: 0, width: 0, height: 0 });

    const staged = stage();

    expect(staged).not.toBeNull();
    expect(part.parentElement).toBe(layer);
    expect(hidden.parentElement).toBe(bar);
  });

  it("stages nothing when a matched bar carries no part", () => {
    part.remove();

    expect(stage()).toBeNull();
  });

  it("steps over a bar this screen does not render", () => {
    // The binding hands over both bar refs; a screen with only a top bar passes
    // null for the other.
    const staged = stage({ bars: [null, bar] });

    expect(staged).not.toBeNull();
    expect(part.parentElement).toBe(layer);
  });

  it("stages without a MutationObserver to follow the hold with", () => {
    // Old engines, and any environment that provides no observer. The parts
    // still travel; only the hold stops tracking, which is the same deal
    // <Morph> takes.
    vi.stubGlobal("MutationObserver", undefined);

    const staged = stage();

    expect(part.parentElement).toBe(layer);
    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.HELD);
    staged!.release();
    expect(part.parentElement).toBe(bar);
    vi.unstubAllGlobals();
  });

  it("mirrors the screen's hold onto the layer so the parts start on its clock", async () => {
    stage();
    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.HELD);

    scope.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.RELEASED);
    await NEXT_FRAME();

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.RELEASED);
  });

  it("reads an unheld screen as released rather than leaving the layer bare", () => {
    scope.removeAttribute(ANIM_HOLD_ATTR);
    stage();

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.RELEASED);
  });

  it("puts the part back exactly where it was, carrying no trace of the flight", () => {
    const sibling = document.createElement("span");
    bar.appendChild(sibling);
    const staged = stage();

    staged!.release();

    expect(part.parentElement).toBe(bar);
    expect(part.nextSibling).toBe(sibling);
    expect(part.getAttribute("style")).toBeNull();
    expect(part.hasAttribute(PART_HOME_ATTR)).toBe(false);
    expect(layer.hasAttribute(ANIM_HOLD_ATTR)).toBe(false);
  });

  it("restores a consumer's own inline style verbatim", () => {
    part.setAttribute("style", "color: red;");
    const staged = stage();

    staged!.release();

    expect(part.getAttribute("style")).toBe("color: red;");
  });

  it("stops watching the hold once the parts are home", async () => {
    const staged = stage();
    staged!.release();

    scope.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.RELEASED);
    await NEXT_FRAME();

    expect(layer.hasAttribute(ANIM_HOLD_ATTR)).toBe(false);
  });

  it("drops a part whose screen went away while it was up here", () => {
    // A replace unmounts the side it replaced. There is nothing to return to,
    // and a part left in the layer would sit above every screen from then on.
    const staged = stage();
    bar.remove();

    staged!.release();

    expect(part.isConnected).toBe(false);
  });

  it("releases a staging nothing ever came back for", () => {
    // A screen still transitional when it goes away never runs the COMPLETED
    // drive that would return its parts.
    vi.useFakeTimers();
    stage({ strandedMs: 500 });
    expect(part.parentElement).toBe(layer);

    vi.advanceTimersByTime(500);

    expect(part.parentElement).toBe(bar);
  });

  it("restores only once when the backstop and the landing race", () => {
    vi.useFakeTimers();
    const sibling = document.createElement("span");
    bar.appendChild(sibling);
    const staged = stage({ strandedMs: 500 });

    staged!.release();
    vi.advanceTimersByTime(500);

    expect(bar.querySelectorAll(`[${PART_NAME_ATTR}]`)).toHaveLength(1);
    expect(part.nextSibling).toBe(sibling);
  });

  it("leaves the hold to the flight that interrupted it", () => {
    // A navigation interrupted mid-flight is followed by one staging over the
    // top of it, and the two stage the same COUNT of the same kind of element —
    // so occupancy cannot tell them apart. The interrupted flight's release
    // must not strip the live one's hold.
    const first = stage();

    const nextScope = document.createElement("div");
    nextScope.setAttribute(SCREEN_ATTR, "screen-2");
    nextScope.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.HELD);
    document.body.appendChild(nextScope);
    const nextBar = document.createElement("div");
    nextBar.setAttribute(BAR_RIDING_ATTR, "false");
    document.body.appendChild(nextBar);
    const nextPart = document.createElement("div");
    nextPart.setAttribute(PART_NAME_ATTR, "navigationIcon");
    nextBar.appendChild(nextPart);
    stubBox(nextPart, { x: 16, y: 44, width: 24, height: 24 });

    const second = stage({ scope: nextScope, bars: [nextBar] });
    first!.release();

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.HELD);
    second!.release();
    expect(layer.hasAttribute(ANIM_HOLD_ATTR)).toBe(false);
  });
});

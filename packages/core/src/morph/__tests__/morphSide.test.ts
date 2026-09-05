import { afterEach, describe, expect, it, vi } from "vitest";

import { DESK_HEAD_ATTR, GOVERNED_ATTR, TRANSITION_ATTR } from "@dom/attributes";

import { headSeconds, resolveMorphSide } from "@morph/morphSide";

// The head kit is announced by an attribute on the root, and the engine stamps
// it from the SAME commit a morph is staged in — after the morph, because React
// runs a descendant's layout effect first. A morph that read the attribute read
// the PREVIOUS flight's answer: right by luck from the second navigation on,
// and wrong on the first, which ran a first push's element 33ms ahead of the
// screen carrying it while every push after it was aligned.
describe("headSeconds", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(DESK_HEAD_ATTR);
    document.documentElement.removeAttribute(GOVERNED_ATTR);
  });

  it("is read from the routing, not from the root's attribute", () => {
    // jsdom is neither a desktop Mac WebKit nor a governed touch session, so
    // the routing says there is no head — whatever the DOM claims.
    document.documentElement.setAttribute(DESK_HEAD_ATTR, "true");
    document.documentElement.setAttribute(GOVERNED_ATTR, "true");

    expect(headSeconds("PUSHING")).toBe(0);
    expect(headSeconds("POPPING")).toBe(0);
  });
});

describe("headSeconds on a session that plays a head", () => {
  const NAV = navigator as { userAgentData?: unknown };

  afterEach(() => {
    delete NAV.userAgentData;
    delete (navigator as unknown as Record<string, unknown>).maxTouchPoints;
  });

  it("counts the governed kit's flat head twice", () => {
    // The governed kit shifts `animation-delay` by the head AND holds one
    // inside the keyframes, so a morph that waited a single head would still
    // start ahead of the screen carrying it.
    Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });

    const push = headSeconds("PUSHING");
    expect(push).toBeGreaterThan(0);
    expect(headSeconds("COMPLETED")).toBe(0);
  });

  it("waits for nothing on the server", () => {
    vi.stubGlobal("document", undefined);
    expect(headSeconds("PUSHING")).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe("resolveMorphSide", () => {
  const screenWith = (name: string | null): HTMLElement => {
    const screen = document.createElement("div");
    if (name !== null) screen.setAttribute(TRANSITION_ATTR, name);
    document.body.appendChild(screen);
    return screen;
  };

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("takes the rect as measured when the screen names no transition it knows", () => {
    // The name comes off the DOM protocol, so it is a plain string and the
    // lookup IS the validation. An unregistered one is not an error: the rect
    // stands as measured and the flight simply corrects for nothing.
    const element = document.createElement("div");
    screenWith(null).appendChild(element);
    expect(resolveMorphSide(element, element.parentElement!, "PUSHING-true")).toMatchObject({
      screenMoves: false,
      screenDuration: 0
    });

    const stranger = screenWith("not-a-registered-transition");
    stranger.appendChild(element);
    expect(resolveMorphSide(element, stranger, "PUSHING-true")).toMatchObject({
      screenMoves: false,
      screenDuration: 0
    });
  });

  it("reads a registered screen's own timing, and whether it moves", () => {
    const screen = screenWith("cupertino");
    const element = document.createElement("div");
    screen.appendChild(element);

    const side = resolveMorphSide(element, screen, "PUSHING-true");
    // cupertino slides its arrival in, which is what makes the morph's
    // destination a moving target.
    expect(side.screenMoves).toBe(true);
    expect(side.screenDuration).toBeGreaterThan(0);
  });

  it("takes off every ancestor pose, whatever kind of box is wearing it", () => {
    // The transition puts its from-pose on whatever its selector list names,
    // and a flight is staged in the middle of that. Device-read on a consumer's
    // tab switch: the only transformed box above the morph at staging was a
    // layer SLOT, with every screen above it at identity — so a rule that asks
    // one kind of box found nothing to undo and left the arrival a whole 1%
    // out, which it snapped back at the landing.
    const screen = screenWith("cupertino");
    const slot = document.createElement("div");
    slot.style.transform = "translate3d(40px, 0, 0)";
    slot.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 0,
        left: 40,
        top: 0,
        width: 200,
        height: 100,
        right: 240,
        bottom: 100
      }) as DOMRect;
    screen.appendChild(slot);
    const element = document.createElement("div");
    slot.appendChild(element);
    element.getBoundingClientRect = () =>
      ({
        x: 140,
        y: 10,
        left: 140,
        top: 10,
        width: 60,
        height: 20,
        right: 200,
        bottom: 30
      }) as DOMRect;

    // Painted at 140 under a box carrying 40, so it rests at 100.
    expect(resolveMorphSide(element, screen, "PUSHING-true").rect).toMatchObject({
      x: 100,
      y: 10,
      width: 60,
      height: 20
    });
  });

  it("takes the rect as measured for a variant that animates nothing", () => {
    // A rest variant has no motion to read a duration or a displacement from.
    const screen = screenWith("cupertino");
    const element = document.createElement("div");
    screen.appendChild(element);

    expect(resolveMorphSide(element, screen, "COMPLETED-true")).toMatchObject({
      screenMoves: false,
      screenDuration: 0
    });
  });
});

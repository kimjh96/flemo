import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createNavigateStore, { type NavigateStatus, type NavigateStoreApi } from "@navigate/store";

import {
  ACTIVE_ATTR,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  MORPH_ATTR,
  MORPH_ROLE,
  PART_NAME_ATTR,
  SCREEN_ATTR,
  STATUS_ATTR,
  TRANSITION_ATTR
} from "@dom/attributes";

import attachMorph from "@morph/attachMorph";
import { registerMorphLayer } from "@morph/morphLayer";

import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";

// jsdom lays nothing out, so every rect a morph reads has to be supplied. That
// is the whole environment this needs: the runtime's inputs are rects and
// protocol attributes, both of which a test can state exactly.
const setRect = (element: HTMLElement, x: number, y: number, width: number, height: number) => {
  element.getBoundingClientRect = () =>
    ({
      x,
      y,
      left: x,
      top: y,
      width,
      height,
      right: x + width,
      bottom: y + height,
      toJSON: () => ({})
    }) as DOMRect;
};

// jsdom has no AnimationEvent constructor; the engine suites shape one the
// same way.
const animationEndEvent = (name: string) => {
  const event = new Event("animationend");
  Object.defineProperty(event, "animationName", { value: name });
  return event;
};

const makeScreen = (transitionName: string, active: boolean) => {
  const screen = document.createElement("div");
  screen.setAttribute(SCREEN_ATTR, "");
  screen.setAttribute(TRANSITION_ATTR, transitionName);
  // A screen renders the status it is in, exactly like the binding does: the
  // runtime reads it to tell a screen that is IN this flight from one that is
  // merely stacked underneath.
  screen.setAttribute(STATUS_ATTR, store.getState().status);
  screen.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  Object.defineProperty(screen, "offsetWidth", { value: 400, configurable: true });
  Object.defineProperty(screen, "offsetHeight", { value: 800, configurable: true });
  setRect(screen, 0, 0, 400, 800);
  document.body.appendChild(screen);
  return screen;
};

// The flip, as the binding performs it: the store's status changes and every
// participating screen re-renders with it.
const flipTo = (status: NavigateStatus) => {
  store.getState().setStatus(status);
  for (const screen of document.querySelectorAll<HTMLElement>(`[${SCREEN_ATTR}]`))
    screen.setAttribute(STATUS_ATTR, status);
};

const makeMorph = (screen: HTMLElement, rect: [number, number, number, number]) => {
  const element = document.createElement("div");
  screen.appendChild(element);
  setRect(element, ...rect);
  return element;
};

let store: NavigateStoreApi;
let inserted: string[];
let layer: HTMLElement;

beforeEach(() => {
  store = createNavigateStore();
  layer = document.createElement("div");
  Object.defineProperty(layer, "offsetWidth", { value: 400, configurable: true });
  Object.defineProperty(layer, "offsetHeight", { value: 800, configurable: true });
  setRect(layer, 0, 0, 400, 800);
  document.body.appendChild(layer);
  registerMorphLayer(store, layer);
  inserted = [];
  vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation((rule: string) => {
    inserted.push(rule);
    return 0;
  });
});

afterEach(() => {
  registerMorphLayer(store, null);
  vi.restoreAllMocks();
  document.body.innerHTML = "";
  document.head.innerHTML = "";
});

describe("attachMorph", () => {
  it("starts the arriving element on its partner's rect", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

    // The flip: the snapshot has to be taken here, while the source is still
    // where the user last saw it.
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // Its BOX travels, from the partner's to its own — not a scale, which
    // would stretch everything inside it.
    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("left: 20px");
    expect(travel).toContain("top: 600px");
    expect(travel).toContain("width: 400px");
    expect(travel).toContain("height: 300px");
    expect(hero.style.animation).toContain("flemo-morph-");
    expect(hero.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.EXIT);
  });

  it("inherits the flying screen's duration when the morph authors none", () => {
    // The built-in preset deliberately has no timing of its own: that is what
    // lets a shared element land with its screen under any transition.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // `layout` runs at 0.4s. The CURVE is the morph's own — a screen's fade can
    // be front-loaded, and a travel borrowed from that curve would jump rather
    // than move. And there is no fade on the arrival: it is opaque from its
    // first frame (see the hand-over test).
    expect(hero.style.animation).toContain("-travel 0.400s");
    expect(hero.style.animation).not.toContain("-fade");
    expect(hero.style.animation).toContain("cubic-bezier(0.4, 0, 0.2, 1)");
  });

  it("hands over by cutting, not by fading", () => {
    // At the first frame the two are the same box in the same place, so that
    // instant is the cheapest possible moment to swap one for the other:
    // exactly one is ever on glass. A fade needs the screen underneath to
    // still be there, and a transition like `none` takes it away in the same
    // frame — which left the arrival fading up out of an empty hole.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(hero.style.animation).not.toContain("-fade");
    // The departure goes in one frame, at the moment the arrival takes over.
    expect(thumbnail.style.animation).toContain("-fade 0.017s");
    expect(thumbnail.style.animation).toContain("0.000s both");
  });

  it("lets a nested morph RIDE its container, starting from the measured from-pose", async () => {
    // Tried the two hard alternatives on glass. Flying free tears the
    // container apart in the air; cancelling the container's transform so the
    // child keeps its own path holds the box together but opens voids inside
    // it. Riding keeps the container a faithful scaled copy of itself — but
    // riding ALONE renders the child at the ARRIVAL's own place inside the
    // travelling box from the first frame, so any difference between the two
    // ends' local arrangement was a lurch at the tap: measured at 20px
    // sideways on the playground's caption, and at 16px on the demo it
    // replaced. So the child rides AND carries a translate from the measured
    // from-delta to identity, exact at both ends of the flight.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    attachMorph(card, { layoutId: "card-1", navigateStore: store });
    attachMorph(label, { layoutId: "title-1", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const heading = makeMorph(bigCard, [16, 260, 360, 32]);
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });
    attachMorph(heading, { layoutId: "title-1", name: "text", navigateStore: store });
    // The decision waits one microtask: a binding mounts effects child-first,
    // so the container has to have declared itself first.
    await Promise.resolve();

    expect(bigCard.parentElement).toBe(layer);
    expect(heading.parentElement).toBe(bigCard);
    // It rides its container's box: not staged, never absolutely positioned.
    const nestedRule = inserted.find((rule) => /flemo-morph-\d+n-travel/.test(rule))!;
    expect(nestedRule).not.toContain("left:");
    expect(nestedRule).not.toContain("top:");
    // And it BEGINS where the pair measured it — the from-delta between the
    // label's box (28, 730) and the heading's (16, 260) — decaying to rest.
    expect(nestedRule).toContain("translate3d(12px, 470px, 0)");
    expect(nestedRule).toMatch(/to \{[^}]*transform: none/);
    // SIZE is the other half of the same correction. Riding sizes the child
    // through the container's width interpolation, and a container that is
    // already at destination width lays the child out full-size on frame one:
    // a 48px thumbnail in a full-width row spread into a strip at the tap. So
    // the child's own box interpolates from the measured from-size (140x20)
    // to its size in the staged container (360x32).
    expect(nestedRule).toContain("width: 140px");
    expect(nestedRule).toContain("height: 20px");
    expect(nestedRule).toContain("width: 360px");
    expect(nestedRule).toContain("height: 32px");
    // Each declaration on its own clean line. An escaped newline once rode
    // into this rule as a literal backslash-n, which silently voided the
    // height declaration: width animated alone and the pop shrank as a
    // squashed rectangle. Substring assertions above cannot catch that.
    expect(nestedRule).not.toContain("\\");
  });

  it("adds no translate to a nested pair whose two ends already agree", async () => {
    // The correction exists for DISAGREEING local arrangements. A pair whose
    // element sits at the same offsets inside both cards needs nothing, and
    // must get nothing: an all-identity travel channel would still cost a
    // keyframe and a composited transform for a no-op.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [36, 620, 128, 20]);
    attachMorph(card, { layoutId: "card-2", navigateStore: store });
    attachMorph(label, { layoutId: "title-2", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    // The SAME box as the label's: the pair's two ends agree exactly.
    const heading = makeMorph(bigCard, [36, 620, 128, 20]);
    attachMorph(bigCard, { layoutId: "card-2", navigateStore: store });
    attachMorph(heading, { layoutId: "title-2", name: "text", navigateStore: store });
    await Promise.resolve();

    const nestedRule = inserted.find((rule) => /flemo-morph-\d+n-travel/.test(rule));
    if (nestedRule) {
      expect(nestedRule).not.toContain("translate3d");
      expect(nestedRule).not.toContain("width:");
    }
  });

  it("stamps inherited line-height as a FACTOR, not as the used length", () => {
    // Computed line-height comes back as a used px length, and stamping that
    // inline on a hoisted container hands every descendant an absolute leading
    // where the tree they left gave them a factor. Measured on a paired card:
    // rows that set only a 13px font were 20px tall at rest and 24px tall in
    // flight, because the card's own used 24px landed on them verbatim.
    const gallery = makeScreen("layout", true);
    const cardFrom = makeMorph(gallery, [20, 600, 160, 160]);
    attachMorph(cardFrom, { layoutId: "card-3", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const cardTo = makeMorph(detail, [0, 0, 400, 340]);
    cardTo.style.fontSize = "16px";
    cardTo.style.lineHeight = "24px";
    attachMorph(cardTo, { layoutId: "card-3", navigateStore: store });

    expect(cardTo.parentElement).toBe(layer);
    expect(cardTo.style.lineHeight).toBe("1.5");
  });

  it("carries a ghost of what it replaces, and drops it on landing", () => {
    // Without it the travelling box can only show the ARRIVAL's content at the
    // departure's size: a list card blown up to a panel leaves a void where the
    // panel's text would be. The ghost starts as an exact copy of what was on
    // glass and dissolves into the real element while the box travels.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    thumbnail.textContent = "from the list";
    const inner = makeMorph(thumbnail, [20, 600, 80, 20]);
    // A binding renders the marker from the first commit, so a paired
    // descendant is recognisable in the copy even before it registers. Only a
    // TEXT pair is dimmed in the copy: the ghost sits on top of the arriving
    // card, so a dimmed non-text copy left a hole the size of the pair on the
    // flight's first frame.
    inner.setAttribute(MORPH_ATTR, "");
    inner.setAttribute("data-flemo-morph-name", "text");
    inner.setAttribute("data-copied-pair", "");
    const art = makeMorph(thumbnail, [20, 620, 80, 60]);
    art.setAttribute(MORPH_ATTR, "");
    art.setAttribute("data-copied-pair-art", "");
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const ghost = layer.querySelector<HTMLElement>("[data-flemo-morph-ghost]")!;
    expect(ghost).not.toBeNull();
    expect(ghost.textContent).toBe("from the list");
    // Staged on the DEPARTURE's box and CARRIED to the arrival's by a
    // transform — it keeps the layout it was captured with, because a copy
    // that re-wraps its own text while the real element re-wraps differently
    // prints the two over each other.
    expect(ghost.style.width).toBe("80px");
    const ghostRule = inserted.find((rule) => rule.includes("g-travel"))!;
    expect(ghostRule).toContain("transform:");
    expect(ghostRule).not.toContain("width:");
    expect(ghost.style.animation).toContain("-travel");
    expect(ghost.style.animation).toContain("-fade");
    // A copy is not a morph: nothing about it may look like one to the runtime.
    expect(ghost.hasAttribute("data-flemo-morph")).toBe(false);
    // And it does not re-print what is already morphing underneath it: a
    // paired descendant keeps its space in the copy's layout and stops
    // painting, or the two print over each other.
    const copiedPair = ghost.querySelector<HTMLElement>("[data-copied-pair]");
    expect(copiedPair?.style.opacity).toBe("0");
    // And a paired NON-TEXT descendant keeps painting in the copy.
    const copiedArt = ghost.querySelector<HTMLElement>("[data-copied-pair-art]");
    expect(copiedArt?.style.opacity).not.toBe("0");

    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));
    expect(layer.querySelector("[data-flemo-morph-ghost]")).toBeNull();
  });

  it("grows a NESTED morph's type on its container's clock", async () => {
    // Two bugs met here and neither was visible in a still frame: a nested
    // morph asked for a screen ancestor it can no longer have (its container
    // took the subtree out of the screen tree), so it never started, and the
    // type just sat at its destination size while the box grew around it.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 200]);
    const label = makeMorph(card, [28, 740, 140, 20]);
    label.style.fontSize = "14px";
    attachMorph(card, { layoutId: "card-1", navigateStore: store });
    attachMorph(label, { layoutId: "title-1", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 440]);
    const heading = makeMorph(bigCard, [16, 300, 360, 32]);
    heading.style.fontSize = "24px";
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });
    attachMorph(heading, { layoutId: "title-1", name: "text", navigateStore: store });
    await Promise.resolve();

    expect(heading.parentElement).toBe(bigCard);
    expect(heading.style.animation).toContain("-travel");
    const growth = inserted.find((rule) => rule.includes("n-travel"))!;
    expect(growth).toContain("font-size: 14px");
    expect(growth).toContain("font-size: 24px");
  });

  it("interpolates a nested element's SHAPE, not just its size", async () => {
    // The artwork inside a card is square in the list and 4:3 on the page it
    // opens into. Without this it is 4:3 from the first frame and only the box
    // around it grows — the "it does not scale proportionally" that is obvious
    // on glass and invisible in any single frame.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 200]);
    const art = makeMorph(card, [28, 610, 145, 145]);
    art.style.aspectRatio = "1 / 1";
    attachMorph(card, { layoutId: "card-1", navigateStore: store });
    attachMorph(art, { layoutId: "art-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 440]);
    const hero = makeMorph(bigCard, [16, 16, 368, 276]);
    hero.style.aspectRatio = "4 / 3";
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });
    attachMorph(hero, { layoutId: "art-1", navigateStore: store });
    await Promise.resolve();

    const reshape = inserted.find((rule) => rule.includes("n-travel"))!;
    expect(reshape).toContain("aspect-ratio: 1 / 1");
    expect(reshape).toContain("aspect-ratio: 4 / 3");
  });

  it("carries the two ends' SPACING, so nothing flinches on the first frame", () => {
    // What flies is the ARRIVAL's tree, so without this it wears the arrival's
    // padding from frame one: a list card at `p-2` handing over to a panel at
    // `p-3` starts with its contents 8px narrower than the ones they replace —
    // a visible step the wrong way at the exact moment of the tap.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 200]);
    card.style.padding = "8px";
    attachMorph(card, { layoutId: "card-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 440]);
    bigCard.style.padding = "12px";
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });

    const travel = inserted.find((rule) => rule.includes("i-travel"))!;
    expect(travel).toContain("padding: 8px 8px 8px 8px");
    expect(travel).toContain("padding: 12px 12px 12px 12px");
  });

  it("keeps a morph alive under a screen transition that has no clock", () => {
    // `none` cuts instantly. The shared element is the reason the navigation is
    // interesting, so it must not be taken down with the screen's timing.
    const gallery = makeScreen("none", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(hero.style.animation).toContain("-travel 0.400s");
  });

  it("grows TYPE instead of scaling it", () => {
    // A scaled heading is a blown-up bitmap of the wrong size. Interpolating
    // font-size is a real re-typeset at every size on the way, which is what
    // "the text grows" has to mean.
    const gallery = makeScreen("layout", true);
    const label = makeMorph(gallery, [20, 600, 100, 20]);
    label.style.fontSize = "14px";
    attachMorph(label, { layoutId: "title-1", name: "text", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const heading = makeMorph(detail, [0, 0, 200, 32]);
    heading.style.fontSize = "24px";
    attachMorph(heading, { layoutId: "title-1", name: "text", navigateStore: store });

    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("font-size: 14px");
    expect(travel).toContain("font-size: 24px");
  });

  it("holds the element's place with a COPY of it, not with a box the size of it", () => {
    // A placeholder measured in pixels is a placeholder that can be wrong, and
    // wrong here is a layout shift lasting exactly as long as the flight.
    // WebKit-measured: a card inside an `inline-block` button left its `<li>`
    // 6.31px taller for the whole flight, because an EMPTY block gives the
    // button no baseline to synthesise from and the line box then adds the
    // strut's descender. A copy of the element has the same box, the same
    // margins and the same baseline, so the layout cannot tell it apart.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const home = document.createElement("div");
    detail.appendChild(home);
    const hero = makeMorph(home, [0, 0, 400, 300]);
    hero.style.marginTop = "16px";
    hero.textContent = "hero";
    hero.setAttribute("data-testid", "hero");
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const standIn = home.querySelector<HTMLElement>("[data-flemo-morph-stand-in]")!;
    expect(standIn).not.toBeNull();
    expect(standIn.textContent).toBe("hero");
    expect(standIn.style.marginTop).toBe("16px");
    expect(standIn.style.visibility).toBe("hidden");
    // A copy must not be able to pass for the original, or be findable as one.
    expect(standIn.hasAttribute("data-flemo-morph")).toBe(false);
    expect(standIn.hasAttribute("data-testid")).toBe(false);
    expect(standIn.inert).toBe(true);
    // The slot itself is left alone — it is still whatever the binding made it.
    expect(home.getAttribute("style")).toBeNull();

    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));
    expect(home.querySelector("[data-flemo-morph-stand-in]")).toBeNull();
    expect(hero.parentElement).toBe(home);
  });

  it("stages the arrival in the flight layer, out of its screen's reach", () => {
    // The whole reason a morph needs no transition of its own. Inside its
    // screen the element would be clipped by it, covered by it and carried
    // along by it; on the layer none of the three can happen, so cupertino gets
    // the same travel as a fade.
    const gallery = makeScreen("cupertino", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("cupertino", true);
    // Held a width off-stage, the way the compiled from-pose leaves it.
    detail.style.transform = "translate3d(400px, 0, 0)";
    setRect(detail, 400, 0, 400, 800);
    const home = document.createElement("div");
    detail.appendChild(home);
    const hero = makeMorph(home, [400, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // Out of the screen and into the layer, staged on the DEPARTURE's box and
    // animating to its own — and the screen being held a width off-stage is
    // undone before either box is computed.
    expect(hero.parentElement).toBe(layer);
    expect(hero.style.position).toBe("absolute");
    expect(hero.style.left).toBe("20px");
    expect(hero.style.width).toBe("80px");
    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("width: 80px");
    expect(travel).toContain("width: 400px");
    // And its place is held by a copy of it, so nothing reflows while it is
    // away (see the stand-in test above).
    expect(home.querySelector("[data-flemo-morph-stand-in]")).not.toBeNull();
  });

  it("lifts the destination's size CLAMPS so an element that fills a screen can still grow", () => {
    // `min-height: 100%` is how an element that fills its screen is written,
    // and a clamp outranks the animation: the flyer would be pinned at full
    // height from the first frame and the growth would never happen. The
    // clamps describe where the element RESTS, so they are lifted for the
    // flight and come back with the rest of the inline style at the landing.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 800]);
    hero.style.minHeight = "100%";
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(hero.style.height).toBe("80px");
    expect(hero.style.minHeight).toBe("0px");
    expect(hero.style.maxHeight).toBe("none");

    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));
    expect(hero.style.minHeight).toBe("100%");
  });

  it("strips the part marker from the ghost, so no entrance replays inside a copy", () => {
    // A part carries its own status, so a copy of it matches the same compiled
    // rule the original does — and the departing screen's choreography would
    // run a second time inside an afterimage.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    const caption = document.createElement("p");
    caption.setAttribute(PART_NAME_ATTR, "detail-content");
    thumbnail.appendChild(caption);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const ghost = layer.querySelector<HTMLElement>("[data-flemo-morph-ghost]")!;
    expect(ghost.querySelector(`[${PART_NAME_ATTR}]`)).toBeNull();
    // The original keeps its own.
    expect(caption.getAttribute(PART_NAME_ATTR)).toBe("detail-content");
  });

  it("mirrors the arriving screen's hold onto the layer", () => {
    // The element is no longer a descendant of the screen, so the compiled hold
    // rule cannot reach it through one. Mirroring is what keeps a morph paused
    // with its screen and released on the same frame.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    detail.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.HELD);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.HELD);
  });

  it("pairs a POP the other way round, where the dismissing screen is the active one", () => {
    // Caught on glass, not here: the active flag follows the STACK, not the
    // direction of travel. On a pop the screen being dismissed is still the top
    // one and keeps `active="true"`, so reading "active" as "the arrival" pairs
    // every pop backwards — which showed up as no pop morph at all, since the
    // only candidate arrival was its own snapshot.
    const library = makeScreen("layout", false);
    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    flipTo("POPPING");

    // The screen returning to view carries active="false" for the whole flight.
    const thumbnail = makeMorph(library, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);
    expect(hero.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.EXIT);
    // Travelling the other way: the box starts at the big cover's and ends at
    // the small one's.
    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("width: 400px");
    expect(travel).toContain("width: 80px");
  });

  it("lets only the arriving side drive the flight", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");

    // Registering the covered side again mid-flight must not start a second,
    // opposite flight.
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    expect(thumbnail.style.animation).toBe("");
  });

  it("does nothing without a partner", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const other = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(other, { layoutId: "unrelated", navigateStore: store });

    expect(other.style.animation).toBe("");
  });

  it("still trades places with a partner that sits outside any screen", () => {
    // A shared bar's mini player is the case in the box: there is no screen
    // motion to cancel for that side, but the two still swap.
    const gallery = makeScreen("layout", true);
    const bar = document.createElement("div");
    document.body.appendChild(bar);
    const mini = document.createElement("div");
    bar.appendChild(mini);
    setRect(mini, 16, 700, 40, 40);
    attachMorph(mini, { layoutId: "track-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const playing = makeScreen("layout", true);
    const art = makeMorph(playing, [24, 80, 352, 352]);
    attachMorph(art, { layoutId: "track-1", navigateStore: store });

    expect(art.style.animation).toContain("-travel");
    expect(mini.style.animation).toContain("-fade");
  });

  it("lands: the travel's end takes every trace of the flight with it", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const travelName = /flemo-morph-\d+i-travel/.exec(hero.style.animation)![0];
    hero.dispatchEvent(animationEndEvent(travelName));

    expect(hero.parentElement).toBe(detail);
    expect(hero.getAttribute("style")).toBeNull();
    expect(hero.getAttribute(MORPH_ATTR)).toBe("");
    // The departure's cut is NOT part of that: it belongs to the flight, and
    // the flight is not over while the navigation still is (see below).
    flipTo("COMPLETED");
    expect(thumbnail.style.animation).toBe("");
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe("");
  });

  it("holds the departure cut until the navigation ends, not until the travel does", () => {
    // Caught on glass under `none`: the screens have no motion of their own, so
    // their span is set by whatever else the author gave them — a <Part>'s
    // choreography — and it outlasted the flight. Lifting the cut at the
    // landing brought the element the user had just watched fly away BACK, at
    // full size, in the middle of a screen that was about to vanish.
    // The suite's default insertRule mock records text and inserts nothing, so
    // a disposer has no rules to drop. This one keeps a real live/dropped
    // ledger, which is what the assertion below is about.
    const live: { cssText: string }[] = [];
    const dropped: { cssText: string }[] = [];
    vi.spyOn(CSSStyleSheet.prototype, "cssRules", "get").mockReturnValue(
      live as unknown as CSSRuleList
    );
    vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation((rule: string) => {
      live.push({ cssText: rule });
      return live.length - 1;
    });
    vi.spyOn(CSSStyleSheet.prototype, "deleteRule").mockImplementation((index: number) => {
      dropped.push(live[index]!);
      live.splice(index, 1);
    });

    const gallery = makeScreen("none", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));

    // Landed — and the departure is still cut, because the screen carrying it
    // is still on glass. The KEYFRAMES the cut is written in have to outlive
    // the travel too: dropping them leaves an `animation` naming nothing,
    // which animates nothing, which is the same resurrection by another route.
    expect(hero.parentElement).toBe(detail);
    expect(thumbnail.style.animation).toContain("-fade");
    expect(dropped).toHaveLength(0);

    flipTo("COMPLETED");
    expect(thumbnail.style.animation).toBe("");
    expect(dropped.length).toBeGreaterThan(0);
  });

  it("does not let one flight's cut become the next flight's restored style", () => {
    // The interrupt: a pop before the push has finished. The element the push
    // CUT (the list card) is the element the pop FLIES, and a flight snapshots
    // the inline style it found so it can put it back at the landing. If the
    // cut is still in that style, landing restores it — the card comes home
    // invisible, and what the user saw was a screen transition with no morph
    // in it at all.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });
    expect(thumbnail.style.animation).toContain("-fade");

    // The pop interrupts. The scope finishes the flight in the air and both
    // sides re-register; the list card is now the ARRIVING side.
    flipTo("POPPING");
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

    const travel = /flemo-morph-\d+i-travel/.exec(thumbnail.style.animation);
    expect(travel).not.toBeNull();
    thumbnail.dispatchEvent(animationEndEvent(travel![0]));

    // Home, and visible: no trace of the cut the interrupted push wrote.
    expect(thumbnail.parentElement).toBe(gallery);
    expect(thumbnail.style.animation).not.toContain("-fade");
  });

  it("pairs even when the flip found nothing to snapshot", () => {
    // The snapshot is taken from the STORE, at the flip. The arriving element
    // registers from the BINDING, in a layout effect. Nothing orders those two
    // against each other: a binding that re-renders synchronously inside the
    // store notification runs its effect before the snapshot is taken, and a
    // screen whose morphs mount late was never in the sweep at all. With no
    // snapshot the pair simply did not happen — a screen transition with no
    // morph in it, once in a while and never on demand.
    //
    // The flip is the BEST moment to measure, not the only one: the departing
    // element is still on glass, and where its screen has been moved to is
    // already corrected for.
    const gallery = makeScreen("layout", true);
    // The flip lands with nothing registered, so the sweep records nothing.
    flipTo("PUSHING");
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const travel = inserted.find((rule) => rule.includes("-travel"));
    expect(travel).toBeDefined();
    expect(travel).toContain("left: 20px");
    expect(travel).toContain("top: 600px");
    expect(travel).toContain("width: 400px");
    expect(hero.parentElement).toBe(layer);
  });

  it("carries its screen as a CAMERA when the transition asks for one", () => {
    // The container transform. A grid cell opening into a full-screen view is
    // not one card leaving a grid that stayed behind — the camera moved to the
    // card, and the rest of the grid went past the edges because it was pushed
    // there. So the screen the element is SMALL on is zoomed by exactly the
    // amount that takes the element from one end of the flight to the other.
    const gallery = makeScreen("none", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    // On a push the grid is the screen being LEFT.
    expect(gallery.getAttribute("data-flemo-morph-camera")).toBeTruthy();
    expect(detail.hasAttribute("data-flemo-morph-camera")).toBe(false);

    const camera = inserted.find((rule) => rule.includes("-camera {"))!;
    expect(camera).toBeDefined();
    // 80px wide becoming 400px is a 5x zoom, and the translate is whatever
    // lands the thumbnail's centre (60, 640) on the hero's (200, 150) about
    // the screen's own transform-origin (200, 400).
    expect(camera).toContain("transform: none");
    expect(camera).toContain("translate(700px, -1450px) scale(5)");
    // Emitted as LONGHANDS: animation-play-state belongs to the compiled hold,
    // and the shorthand would take it.
    const applied = inserted.find((rule) => rule.includes("data-flemo-morph-camera"))!;
    expect(applied).toContain("animation-name:");
    expect(applied).not.toContain("animation-play-state");
    expect(applied).not.toContain("animation:");
  });

  it("points the camera at the returning screen on a pop, and runs the zoom backwards", () => {
    // Same rule, no special case: the camera lives with the screen holding the
    // SMALLER box, which on a pop is the one being returned to. It starts
    // zoomed in on the element and settles back to rest.
    const gallery = makeScreen("none", false);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    flipTo("POPPING");
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    expect(gallery.getAttribute("data-flemo-morph-camera")).toBeTruthy();
    expect(detail.hasAttribute("data-flemo-morph-camera")).toBe(false);
    const camera = inserted.filter((rule) => rule.includes("-camera {")).at(-1)!;
    // Reversed: zoomed at the start, resting at the end.
    expect(camera.indexOf("scale(5)")).toBeLessThan(camera.indexOf("transform: none"));
  });

  it("gives no camera to a morph that did not ask for one", () => {
    const gallery = makeScreen("none", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(gallery.hasAttribute("data-flemo-morph-camera")).toBe(false);
    expect(inserted.some((rule) => rule.includes("-camera"))).toBe(false);
  });

  it("holds the camera until the navigation ends, like every other flight residue", () => {
    // Dropping it at the landing snaps the whole background back while the
    // screen it belongs to is still on glass — the same failure as lifting the
    // departure's cut early, one layer out.
    const gallery = makeScreen("none", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("none", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));
    expect(gallery.hasAttribute("data-flemo-morph-camera")).toBe(true);

    flipTo("COMPLETED");
    expect(gallery.hasAttribute("data-flemo-morph-camera")).toBe(false);
  });

  it("opens a NESTED element's corner too, instead of stepping it on the first frame", () => {
    // Caught on glass in the `layout` fixture: the card's corner interpolated
    // and the artwork's did not. A nested morph got every other channel — its
    // type, its shape, its spacing — but wore its destination's radius from
    // the first frame, so a 12px thumbnail corner opening into a 16px one
    // stepped the whole 4px at the instant of the tap and then held there for
    // the rest of the flight.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const art = makeMorph(card, [28, 608, 144, 144]);
    art.style.borderRadius = "12px";
    attachMorph(card, { layoutId: "card-1", navigateStore: store });
    attachMorph(art, { layoutId: "art-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const hero = makeMorph(bigCard, [16, 16, 368, 276]);
    hero.style.borderRadius = "16px";
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });
    attachMorph(hero, { layoutId: "art-1", navigateStore: store });

    return Promise.resolve().then(() => {
      const nested = inserted.filter((rule) => /flemo-morph-\d+n-paint/.test(rule));
      expect(nested).toHaveLength(1);
      expect(nested[0]).toContain("border-radius: 12px");
      expect(nested[0]).toContain("border-radius: 16px");
      expect(hero.style.animation).toContain("n-paint");
    });
  });

  it("does not pair with an element on a screen that is not in this flight", () => {
    // Caught on glass in the chain fixture. A layoutId is a name, not an
    // address: the same one can sit on a screen DEEP in the stack, and pairing
    // by name alone let a navigation between two other screens grab it. What
    // the user saw was a morph running on a pop that had no shared element in
    // it at all — one screen's card flying to another screen's card, neither
    // of them the pair the author wrote.
    const deep = makeScreen("cupertino", false);
    const buried = makeMorph(deep, [20, 600, 80, 80]);
    attachMorph(buried, { layoutId: "photo-1", navigateStore: store });

    const returning = makeScreen("material", false);
    const hero = makeMorph(returning, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    makeScreen("material", true);

    flipTo("POPPING");
    // A screen below the direct prev pins its status — the binding does this
    // for every stacked screen, and it is what says "not in this flight".
    deep.setAttribute(STATUS_ATTR, "COMPLETED");
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // The only other element with this layoutId is two screens down, resting.
    // There is no pair here, so there is no flight.
    expect(inserted.some((rule) => rule.includes("-travel"))).toBe(false);
    expect(hero.parentElement).toBe(returning);
    expect(layer.childElementCount).toBe(0);
  });

  it("does not pair with a partner that has left the document", () => {
    // The other half of the same bug: snapshots outlive the screens they were
    // taken from, so a stack that had been walked once left a rect behind for
    // every layoutId in it. Walking it again staged the arriving element at a
    // box measured on a screen that no longer exists — the element appeared,
    // full size, in the middle of nowhere, before its own screen had arrived.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    // The screen it was measured on is gone by the time the arrival mounts.
    thumbnail.remove();

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(inserted.some((rule) => rule.includes("-travel"))).toBe(false);
    expect(hero.parentElement).toBe(detail);
  });

  it("carries the two ends' SURFACE, so the colour does not flip at the tap", () => {
    // Caught on glass: a card on the panel colour opening into a sheet on the
    // page colour. The arrival wore the destination's background from the
    // first frame, so the surface flipped at the instant of the tap and only
    // the box moved afterwards — two events where the author wrote one.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    thumbnail.style.backgroundColor = "rgb(247, 248, 250)";
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    hero.style.backgroundColor = "rgb(255, 255, 255)";
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const surface = inserted.find((rule) => rule.includes("-paint"))!;
    expect(surface).toBeDefined();
    expect(surface).toContain("background-color: rgb(247, 248, 250)");
    expect(surface).toContain("background-color: rgb(255, 255, 255)");
    // Its own animation: the travel keyframe must stay on the compositor.
    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).not.toContain("background");
  });

  it("leaves a surface alone when both ends are painted the same", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(inserted.some((rule) => rule.includes("-paint"))).toBe(false);
  });

  it("carries every paint channel the two ends set differently, not a chosen few", () => {
    // The list used to be a branch per property in the keyframe emitter, and it
    // was only ever as complete as the last thing someone noticed on glass: the
    // padding flinch, then the type, then the corner, then the surface colour.
    // A card with a shadow and a border opening into a screen without them had
    // exactly the same step waiting, and nothing would have caught it.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    thumbnail.style.borderStyle = "solid";
    thumbnail.style.borderWidth = "2px";
    thumbnail.style.borderColor = "rgb(10, 20, 30)";
    thumbnail.style.boxShadow = "rgba(0, 0, 0, 0.2) 0px 4px 12px 0px";
    thumbnail.style.color = "rgb(0, 0, 0)";
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    hero.style.borderStyle = "solid";
    hero.style.borderWidth = "0px";
    hero.style.borderColor = "rgb(200, 210, 220)";
    hero.style.boxShadow = "none";
    hero.style.color = "rgb(255, 255, 255)";
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const paint = inserted.find((rule) => rule.includes("-paint"))!;
    expect(paint).toBeDefined();
    expect(paint).toContain("border-color: rgb(10, 20, 30)");
    expect(paint).toContain("border-color: rgb(200, 210, 220)");
    expect(paint).toContain("border-width: 2px");
    expect(paint).toContain("border-width: 0px");
    expect(paint).toContain("box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 12px 0px");
    expect(paint).toContain("box-shadow: none");
    expect(paint).toContain("color: rgb(0, 0, 0)");
    expect(paint).toContain("color: rgb(255, 255, 255)");
    // All of it on ONE animation, and none of it on the travel.
    expect(inserted.filter((rule) => rule.includes("-paint"))).toHaveLength(1);
    expect(inserted.find((rule) => rule.includes("-travel"))!).not.toContain("box-shadow");
  });

  it("gives the departure's own content a window to LEAVE in, not three frames", () => {
    // What a pop looked like next to the push it was supposed to reverse: the
    // arriving content rose in over the whole flight, and the departing
    // content — a caption, a paragraph, a button with no counterpart — was
    // gone before the box had moved. It leaves on the GHOST, and the ghost's
    // window was 22% of the flight, which on a 0.4s morph is three frames.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    thumbnail.textContent = "from the list";
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const ghost = layer.querySelector<HTMLElement>("[data-flemo-morph-ghost]")!;
    // `layout` runs 0.4s; the copy now dissolves over more than half of it.
    const window = /-fade (\d+\.\d+)s/.exec(ghost.style.animation)!;
    expect(Number(window[1])).toBeGreaterThan(0.2);
  });

  it("cuts the departure from the flight's first frame, with no window to be caught in", () => {
    // The departure rides the screen it belongs to; the flight does not. So a
    // window in which it is BOTH still painting AND already carried away by
    // that screen is a second copy of the card offset from the real one. It
    // used to be one frame wide, which is invisible until a frame is missed:
    // desktop Safari measured a 36ms gap between two rAF callbacks, and the
    // stale opacity landed on glass 15px from where the flight was.
    //
    // So both ends of the cut are the same pose, and the fill hides it from
    // staging. What this asserts is the ABSENCE of an interpolation: no
    // opacity between 0 and 1 exists anywhere in the departure's rule.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // The departure wears a rule of its own, and it is the cut.
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.EXIT);
    const cutName = /flemo-morph-(\w+?o)-fade/.exec(thumbnail.style.animation)?.[1];
    expect(cutName).toBeDefined();
    const cut = inserted.find((rule) => rule.includes(`${cutName}-fade`))!;
    expect(cut).toBeDefined();
    // Every opacity it declares is the hidden one.
    const opacities = [...cut.matchAll(/opacity:\s*([\d.]+)/g)].map((match) => Number(match[1]));
    expect(opacities.length).toBeGreaterThan(0);
    expect(opacities.every((value) => value === 0)).toBe(true);
    // And it fills BACKWARDS, so the head is covered too.
    expect(thumbnail.style.animation).toContain("both");
  });

  it("does not land on an animationend that ran for no time", () => {
    // The flight's landing is triggered by the travel's own `animationend`.
    // But an animation that is torn down and rebuilt — a style recalculation
    // WebKit resolves by replacing it — also reports an END, with the name, the
    // keyframes and the duration all intact and `elapsedTime: 0`. Landing on
    // that puts the element back in its screen before it has moved: measured on
    // desktop Safari as a morph that simply does not happen while the screen
    // transition runs normally.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(layer.contains(hero)).toBe(true);
    const geometry = /flemo-morph-(\w+?i)-travel/.exec(hero.style.animation)![0];

    // The rebuilt animation's end: right name, no elapsed time.
    hero.dispatchEvent(
      Object.assign(new Event("animationend", { bubbles: true }), {
        animationName: geometry,
        elapsedTime: 0
      })
    );
    expect(layer.contains(hero)).toBe(true);

    // The real one lands it.
    hero.dispatchEvent(
      Object.assign(new Event("animationend", { bubbles: true }), {
        animationName: geometry,
        elapsedTime: 0.4
      })
    );
    expect(layer.contains(hero)).toBe(false);
  });

  it("lands a NESTED morph on its own animation's end", async () => {
    // A nested morph is its own flight record — it has to be taken off the
    // scope's book when it is done, and give its element back exactly the
    // style the consumer wrote, or the next flight restores this one's.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    label.style.fontSize = "14px";
    attachMorph(card, { layoutId: "card-1", navigateStore: store });
    attachMorph(label, { layoutId: "title-1", name: "text", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const heading = makeMorph(bigCard, [16, 260, 360, 32]);
    heading.style.fontSize = "24px";
    attachMorph(bigCard, { layoutId: "card-1", navigateStore: store });
    attachMorph(heading, { layoutId: "title-1", name: "text", navigateStore: store });
    await Promise.resolve();

    const nestedName = /flemo-morph-\d+n-(?:travel|paint)/.exec(heading.style.animation)![0];

    // An end that ran for no time is a rebuilt animation, not a finished one —
    // the same rule the container's landing keeps.
    const early = animationEndEvent(nestedName);
    Object.defineProperty(early, "elapsedTime", { value: 0 });
    heading.dispatchEvent(early);
    expect(heading.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);

    const real = animationEndEvent(nestedName);
    Object.defineProperty(real, "elapsedTime", { value: 0.4 });
    heading.dispatchEvent(real);

    expect(heading.getAttribute(MORPH_ATTR)).toBe("");
    // Exactly the style the consumer wrote, and nothing the flight added.
    expect(heading.getAttribute("style")).toBe("font-size: 24px;");
  });

  it("brings a NESTED morph home on the backstop when no end ever arrives", async () => {
    // Nothing guarantees an `animationend`: a rule dropped from the sheet, an
    // element hidden mid-flight, a browser that cancels rather than ends. The
    // net is what keeps the element from staying marked for the rest of the
    // session.
    vi.useFakeTimers();
    try {
      const gallery = makeScreen("layout", true);
      const card = makeMorph(gallery, [20, 600, 160, 160]);
      const label = makeMorph(card, [28, 730, 140, 20]);
      label.style.fontSize = "14px";
      attachMorph(card, { layoutId: "card-2", navigateStore: store });
      attachMorph(label, { layoutId: "title-2", name: "text", navigateStore: store });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const bigCard = makeMorph(detail, [0, 0, 400, 340]);
      const heading = makeMorph(bigCard, [16, 260, 360, 32]);
      heading.style.fontSize = "24px";
      attachMorph(bigCard, { layoutId: "card-2", navigateStore: store });
      attachMorph(heading, { layoutId: "title-2", name: "text", navigateStore: store });
      await vi.advanceTimersByTimeAsync(0);

      expect(heading.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);
      await vi.advanceTimersByTimeAsync(5_000);
      expect(heading.getAttribute(MORPH_ATTR)).toBe("");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores an animationend that belongs to something else on the element", () => {
    // The flyer keeps whatever the consumer was already animating inside it,
    // and those ends bubble to the same listener.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    hero.dispatchEvent(animationEndEvent("someone-elses-animation"));
    expect(hero.parentElement).toBe(layer);

    const travelName = /flemo-morph-\d+i-travel/.exec(hero.style.animation)![0];
    hero.dispatchEvent(animationEndEvent(travelName));
    expect(hero.parentElement).toBe(detail);
    // A second end changes nothing: the flight is already off the books.
    hero.dispatchEvent(animationEndEvent(travelName));
    expect(hero.parentElement).toBe(detail);
  });

  it("drops an element whose home left the document while it was flying", () => {
    // The slot the element flew out of is React's promise that it can be put
    // back. A screen that unmounts mid-flight takes that promise with it, and
    // putting the element back into a detached tree would leave it on the
    // layer instead.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    detail.remove();
    hero.dispatchEvent(animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0]));

    expect(hero.isConnected).toBe(false);
    expect(layer.contains(hero)).toBe(false);
  });

  it("declines a flight with no box at either end", () => {
    // An element that has not laid out has no honest travel to compute, and
    // dividing by its zero reaches the compositor as an infinity.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const unlaid = makeMorph(detail, [0, 0, 0, 0]);
    attachMorph(unlaid, { layoutId: "photo-1", navigateStore: store });

    expect(unlaid.parentElement).toBe(detail);
    expect(unlaid.style.animation).toBe("");
  });

  it("declines a flight whose ORIGIN never had a box", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 0, 0]);
    attachMorph(thumbnail, { layoutId: "photo-3", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-3", navigateStore: store });

    expect(hero.parentElement).toBe(detail);
    expect(hero.style.animation).toBe("");
  });

  it("flies where there is no MutationObserver to mirror the hold with", () => {
    // The mirror is how the layer stays under the same pause as the screens.
    // Without an observer the first mirror still happens; what is lost is
    // tracking later changes, not the flight.
    const observer = globalThis.MutationObserver;
    (globalThis as { MutationObserver?: unknown }).MutationObserver = undefined;
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      detail.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.HELD);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

      expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.HELD);
      hero.dispatchEvent(
        animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0])
      );
      expect(hero.parentElement).toBe(detail);
    } finally {
      (globalThis as { MutationObserver?: unknown }).MutationObserver = observer;
    }
  });

  it("forgets a snapshot whose element left the document", async () => {
    // Snapshots outlive the flight that took them, which is what lets an
    // interrupted navigation continue from where the eye last had the element.
    // They must not outlive the ELEMENT: a stack walked twice would otherwise
    // measure its second walk against rects taken on screens that are gone —
    // the element appearing full size in the middle of nowhere.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    const dispose = attachMorph(thumbnail, { layoutId: "photo-9", navigateStore: store });
    flipTo("PUSHING");

    // The screen goes, and the registration with it.
    gallery.remove();
    dispose();
    flipTo("COMPLETED");
    flipTo("POPPING");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-9", navigateStore: store });

    // Nothing to pair with — and above all not a rect measured on a screen
    // that no longer exists.
    expect(hero.parentElement).toBe(detail);
    expect(hero.style.animation).toBe("");
  });

  it("ignores a store notification that did not change the status", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // A task id changing is not a navigation starting; finishing the flights
    // here would land the element before it had moved.
    store.getState().setStatus("PUSHING");

    expect(hero.parentElement).toBe(layer);
  });

  it("drops only its own registration when an element is re-registered", () => {
    // A binding re-registers on every status change, and React runs the
    // previous effect's cleanup AFTER the next one's setup in some paths. A
    // disposer that deleted whatever it found would unregister the live entry.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    const disposeFirst = attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    disposeFirst();

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // The second registration is still there, so the pair still flies.
    expect(hero.parentElement).toBe(layer);
  });

  it("names every decision on the trace when it is armed", () => {
    // A morph that declines is silent by design — a broken shared element must
    // never take the navigation down with it — so a miss looks exactly like a
    // screen transition with no morph in it. Armed, each decision says which
    // it was.
    sessionStorage.setItem("flemo:morph", "on");
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

      const trace = () =>
        ((globalThis as { flemoMorphTrace?: { why: string }[] }).flemoMorphTrace ?? []).map(
          (line) => line.why
        );

      // Registered while nothing is navigating: the commonest decision of all.
      expect(trace()).toContain("not-transitional");

      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");
      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, { layoutId: "photo-1", navigateStore: store });
      hero.dispatchEvent(
        animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0])
      );

      expect(trace()).toContain("land");
    } finally {
      sessionStorage.clear();
      delete (globalThis as { flemoMorphTrace?: unknown }).flemoMorphTrace;
    }
  });

  it("keeps the trace to its last few hundred decisions", () => {
    // A screen with a grid of pairs writes a line per pair per status change,
    // so the buffer has to hold a navigation's worth without growing forever.
    sessionStorage.setItem("flemo:morph", "on");
    try {
      const gallery = makeScreen("layout", true);
      for (let index = 0; index < 520; index += 1) {
        const cell = makeMorph(gallery, [0, 0, 10, 10]);
        attachMorph(cell, { layoutId: `cell-${index}`, navigateStore: store });
      }

      const trace = (globalThis as { flemoMorphTrace?: unknown[] }).flemoMorphTrace ?? [];
      expect(trace.length).toBeLessThanOrEqual(500);
      expect(trace.length).toBeGreaterThan(400);
    } finally {
      sessionStorage.clear();
      delete (globalThis as { flemoMorphTrace?: unknown }).flemoMorphTrace;
    }
  });

  it("fades the arrival in when the author gave it a pose to fade from", () => {
    // The presets do not: the arrival is opaque and the ghost dissolves on top
    // of it, because fading both bleeds the background through the pair. An
    // author who asks for the other thing gets it.
    morphTransitionMap.set(
      "fading" as never,
      createMorphTransition({
        name: "fading" as never,
        initial: { opacity: 0, x: "10%" },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 1, x: 0 }, options: { duration: 0.5, delay: 0.05 } },
        exit: { value: { opacity: 0 }, options: {} },
        options: { crossFade: 0.25, radius: false }
      })
    );
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, {
        layoutId: "photo-5",
        name: "fading" as never,
        navigateStore: store
      });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, { layoutId: "photo-5", name: "fading" as never, navigateStore: store });

      // Its own duration, its own delay, its own cross-fade window — and the
      // authored translate composed on top of the measured travel.
      expect(hero.style.animation).toContain("-travel 0.500s");
      expect(hero.style.animation).toContain("0.050s both");
      expect(hero.style.animation).toContain("-fade 0.125s");
      const travel = inserted.find((rule) => rule.includes("-travel"))!;
      expect(travel).toContain("translate3d(40px, 0px, 0)");
    } finally {
      morphTransitionMap.delete("fading" as never);
    }
  });

  it("takes the rects as measured when an authored pose cannot be resolved", () => {
    // A length this runtime cannot turn into a number would be a GUESS, and a
    // guessed pose puts the shared element somewhere it never was.
    morphTransitionMap.set(
      "unresolvable" as never,
      createMorphTransition({
        name: "unresolvable" as never,
        initial: { x: "2rem" },
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { x: "calc(100% - 8px)" }, options: { duration: 0.4 } },
        exit: { value: { opacity: 0 }, options: {} }
      })
    );
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, {
        layoutId: "photo-6",
        name: "unresolvable" as never,
        navigateStore: store
      });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, {
        layoutId: "photo-6",
        name: "unresolvable" as never,
        navigateStore: store
      });

      const travel = inserted.find((rule) => rule.includes("-travel"))!;
      expect(travel).toContain("left: 20px");
      expect(travel).not.toContain("translate3d");
    } finally {
      morphTransitionMap.delete("unresolvable" as never);
    }
  });

  it("falls back to the built-in preset for a name nobody registered", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-7", name: "nope" as never, navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-7", name: "nope" as never, navigateStore: store });

    expect(hero.parentElement).toBe(layer);
  });

  it("points the camera at whatever origin the screen actually scales about", () => {
    // Read rather than assumed: a consumer who moved the origin must not get a
    // background that zooms toward the wrong corner. A percentage read as a
    // length would put the anchor 50px from the corner of an 800px screen.
    for (const [origin, expected] of [
      ["left top", "translate(0px, 0px)"],
      ["10px 20px", "translate("],
      ["nonsense", "translate("]
    ] as const) {
      const gallery = makeScreen("layout", true);
      gallery.style.transformOrigin = origin;
      const thumbnail = makeMorph(gallery, [0, 0, 100, 100]);
      attachMorph(thumbnail, { layoutId: `zoomed-${origin}`, name: "zoom", navigateStore: store });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 400]);
      attachMorph(hero, { layoutId: `zoomed-${origin}`, name: "zoom", navigateStore: store });

      const cameraRule = inserted.find((rule) => rule.includes("-camera {"))!;
      expect(cameraRule).toContain(expected);
      hero.dispatchEvent(
        animationEndEvent(/flemo-morph-\d+i-travel/.exec(hero.style.animation)![0])
      );
      flipTo("COMPLETED");
      document.body.querySelectorAll(`[${SCREEN_ATTR}]`).forEach((node) => node.remove());
      inserted.length = 0;
    }
  });

  it("stages a flight in a layer that has not been laid out", () => {
    // A layer inside a transformed ancestor is measured against its own laid
    // out size to find the ratio. Before layout there is no ratio to find, and
    // dividing by that zero would send the flight to infinity.
    Object.defineProperty(layer, "offsetWidth", { value: 0, configurable: true });
    Object.defineProperty(layer, "offsetHeight", { value: 0, configurable: true });

    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-8", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-8", navigateStore: store });

    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("left: 20px");
    expect(travel).not.toContain("Infinity");
  });

  it("flies where there are no computed styles to read", () => {
    // Everything the runtime reads off the computed style is an enhancement —
    // the inherited type the stand-in has to keep, the paint channels, the
    // screen's origin. The travel is not, and it still has to happen.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    vi.stubGlobal("getComputedStyle", undefined);
    try {
      attachMorph(hero, { layoutId: "photo-1", navigateStore: store });
      expect(hero.parentElement).toBe(layer);
      expect(inserted.find((rule) => rule.includes("-travel"))).toContain("width: 400px");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stages a flight in a layer that has not been painted", () => {
    // Laid out but not painted — a layer inside a `content-visibility: hidden`
    // ancestor measures zero. The ratio it would give is zero, and a rect
    // divided by it is an infinity on the compositor.
    setRect(layer, 0, 0, 0, 0);

    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    const travel = inserted.find((rule) => rule.includes("-travel"))!;
    expect(travel).toContain("left: 20px");
    expect(travel).not.toContain("Infinity");
  });

  it("clamps a cross-fade window that would outlast the flight", () => {
    morphTransitionMap.set(
      "long-faded" as never,
      createMorphTransition({
        name: "long-faded" as never,
        initial: {},
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 1 }, options: { duration: 0.4 } },
        exit: { value: { opacity: 0 }, options: {} },
        options: { crossFade: 2 }
      })
    );
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, {
        layoutId: "photo-11",
        name: "long-faded" as never,
        navigateStore: store
      });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, {
        layoutId: "photo-11",
        name: "long-faded" as never,
        navigateStore: store
      });

      // The ghost dissolves over the flight, never past it: a fade still
      // running at the landing is a copy of the departure left on the layer.
      const ghost = layer.querySelector<HTMLElement>("[data-flemo-morph-ghost]");
      expect(ghost?.style.animation ?? "").toContain("0.400s");
    } finally {
      morphTransitionMap.delete("long-faded" as never);
    }
  });

  it("clamps a cross-fade window an author put outside the flight", () => {
    morphTransitionMap.set(
      "over-faded" as never,
      createMorphTransition({
        name: "over-faded" as never,
        initial: {},
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 1 }, options: { duration: 0.4 } },
        exit: { value: { opacity: 0 }, options: {} },
        options: { crossFade: -2 }
      })
    );
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, {
        layoutId: "photo-4",
        name: "over-faded" as never,
        navigateStore: store
      });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, {
        layoutId: "photo-4",
        name: "over-faded" as never,
        navigateStore: store
      });

      // A negative window means no ghost at all, not a negative duration in a
      // keyframe — and the travel itself is unaffected.
      expect(hero.parentElement).toBe(layer);
      expect(inserted.find((rule) => rule.includes("-travel"))).toContain("left: 20px");
      expect(inserted.some((rule) => rule.includes("-ghost"))).toBe(false);
    } finally {
      morphTransitionMap.delete("over-faded" as never);
    }
  });

  it("lets an element inside an unpaired morph fly on its own", async () => {
    // A container that has no partner this navigation is not a flight, so the
    // element inside it is not riding anything — it flies, and its ghost has to
    // stack above a container that is still painting.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    attachMorph(card, { layoutId: "lonely-card", navigateStore: store });
    attachMorph(label, { layoutId: "title-5", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const panel = makeMorph(detail, [0, 0, 400, 340]);
    panel.setAttribute(MORPH_ATTR, "");
    const heading = makeMorph(panel, [16, 260, 360, 32]);
    attachMorph(heading, { layoutId: "title-5", navigateStore: store });
    // The decision waits a microtask: a container has to decline before the
    // morphs inside it know they are not riding one.
    await Promise.resolve();

    expect(heading.parentElement).toBe(layer);
  });

  it("says which decision it took for an element that is on no screen at all", () => {
    sessionStorage.setItem("flemo:morph", "on");
    try {
      const orphan = document.createElement("div");
      document.body.appendChild(orphan);
      setRect(orphan, 0, 0, 40, 40);
      attachMorph(orphan, { layoutId: "orphan-1", navigateStore: store });
      flipTo("PUSHING");
      attachMorph(orphan, { layoutId: "orphan-1", navigateStore: store });

      const why = (
        (globalThis as { flemoMorphTrace?: { why: string }[] }).flemoMorphTrace ?? []
      ).map((line) => line.why);
      expect(why).toContain("no-screen");
    } finally {
      sessionStorage.clear();
      delete (globalThis as { flemoMorphTrace?: unknown }).flemoMorphTrace;
    }
  });

  it("reads a screen's transform-origin however it is written", async () => {
    // A percentage read as a length would put the camera's anchor 50px from the
    // corner of an 800px screen — a zoom toward the wrong place. jsdom hands
    // back the specified value rather than resolving it, which is exactly the
    // environment the keyword and single-token forms have to survive.
    for (const [origin, expected] of [
      ["left top", "translate(0px, 0px)"],
      ["left", "translate(0px, "],
      ["nonsense nonsense", "translate("]
    ] as const) {
      vi.stubGlobal("getComputedStyle", () => ({ transformOrigin: origin }));
      try {
        const gallery = makeScreen("layout", true);
        const thumbnail = makeMorph(gallery, [0, 0, 100, 100]);
        attachMorph(thumbnail, { layoutId: "cam-1", name: "zoom", navigateStore: store });
        flipTo("PUSHING");
        gallery.setAttribute(ACTIVE_ATTR, "false");

        const detail = makeScreen("layout", true);
        const hero = makeMorph(detail, [0, 0, 400, 400]);
        attachMorph(hero, { layoutId: "cam-1", name: "zoom", navigateStore: store });

        expect(inserted.find((rule) => rule.includes("-camera {"))).toContain(expected);
      } finally {
        vi.unstubAllGlobals();
      }
      document.body.querySelectorAll(`[${SCREEN_ATTR}]`).forEach((node) => node.remove());
      inserted.length = 0;
      flipTo("COMPLETED");
    }
  });

  it("aims a camera where there are no computed styles to read", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [0, 0, 100, 100]);
    attachMorph(thumbnail, { layoutId: "cam-2", name: "zoom", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 400]);
    vi.stubGlobal("getComputedStyle", undefined);
    try {
      attachMorph(hero, { layoutId: "cam-2", name: "zoom", navigateStore: store });
      // No origin to read is the same as the default one: the screen's centre.
      expect(inserted.find((rule) => rule.includes("-camera {"))).toContain("scale(4)");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("carries a NESTED element's own spacing too", async () => {
    // Same reason as the container's padding: a nested element sits where its
    // ARRIVAL's margins put it from the first frame otherwise, which is a
    // flinch at the exact moment of the tap.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    label.style.padding = "2px";
    label.style.margin = "1px";
    attachMorph(card, { layoutId: "card-7", navigateStore: store });
    attachMorph(label, { layoutId: "title-7", name: "text", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const heading = makeMorph(bigCard, [16, 260, 360, 32]);
    heading.style.padding = "8px";
    heading.style.margin = "4px";
    attachMorph(bigCard, { layoutId: "card-7", navigateStore: store });
    attachMorph(heading, { layoutId: "title-7", name: "text", navigateStore: store });
    await Promise.resolve();

    const growth = inserted.find((rule) => rule.includes("n-travel"))!;
    expect(growth).toContain("padding: 2px");
    expect(growth).toContain("margin: 4px");
  });

  it("gives a NESTED element back the absence of a style attribute", async () => {
    // The flight writes an inline `animation` onto an element that had no
    // `style` at all. Landing has to remove the attribute rather than leave an
    // empty one, or the consumer's DOM is not what they wrote.
    const sheet = document.createElement("style");
    sheet.textContent = ".small { font-size: 14px } .big { font-size: 24px }";
    document.head.appendChild(sheet);

    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    label.className = "small";
    attachMorph(card, { layoutId: "card-8", navigateStore: store });
    attachMorph(label, { layoutId: "title-8", name: "text", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const heading = makeMorph(bigCard, [16, 260, 360, 32]);
    heading.className = "big";
    attachMorph(bigCard, { layoutId: "card-8", navigateStore: store });
    attachMorph(heading, { layoutId: "title-8", name: "text", navigateStore: store });
    await Promise.resolve();

    const nestedName = /flemo-morph-\d+n-(?:travel|paint)/.exec(heading.style.animation)![0];
    // Something else on the element ending is not this flight ending.
    heading.dispatchEvent(animationEndEvent("not-this-flight"));
    expect(heading.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);

    const real = animationEndEvent(nestedName);
    Object.defineProperty(real, "elapsedTime", { value: 0.4 });
    heading.dispatchEvent(real);
    expect(heading.getAttribute("style")).toBeNull();

    // And a second end is not a second landing.
    heading.dispatchEvent(real);
    expect(heading.getAttribute("style")).toBeNull();
  });

  it("measures a partner that is already in the flight layer", () => {
    // An interrupted navigation: the element the new flight pairs with is
    // mid-flight itself, so it is not on any screen. What it is WEARING is
    // where it is, and there is no screen pose to undo.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    // Straight into the layer, exactly as a flight would have staged it, and
    // registered only now — so there is no snapshot for the arrival to find and
    // it has to measure the partner where it currently is.
    layer.appendChild(thumbnail);
    attachMorph(thumbnail, { layoutId: "photo-2", navigateStore: store });

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-2", navigateStore: store });

    expect(hero.parentElement).toBe(layer);
    expect(inserted.find((rule) => rule.includes("-travel"))).toContain("left: 20px");
  });

  it("declines when there is no morph transition to fly at all", () => {
    // The preset is a registration like any other: a consumer bundling their
    // own registry, or a teardown that ran early, can leave the map empty.
    const preset = morphTransitionMap.get("shared" as never)!;
    morphTransitionMap.delete("shared" as never);
    try {
      const gallery = makeScreen("layout", true);
      const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
      attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
      flipTo("PUSHING");
      gallery.setAttribute(ACTIVE_ATTR, "false");

      const detail = makeScreen("layout", true);
      const hero = makeMorph(detail, [0, 0, 400, 300]);
      attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

      expect(hero.parentElement).toBe(detail);
      expect(hero.style.animation).toBe("");
    } finally {
      morphTransitionMap.set("shared" as never, preset);
    }
  });

  it("re-registering during a flight does not restart or abort it", () => {
    // A binding re-registers on every status change; that is the contract, and
    // it must be free.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    const dispose = attachMorph(hero, { layoutId: "photo-1", navigateStore: store });
    const first = hero.style.animation;

    dispose();
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    expect(hero.style.animation).toBe(first);
  });
});

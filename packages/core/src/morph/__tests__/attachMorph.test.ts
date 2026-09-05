import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createNavigateStore, { type NavigateStatus, type NavigateStoreApi } from "@navigate/store";

import {
  ACTIVE_ATTR,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  MORPH_ATTR,
  MORPH_ROLE,
  PART_NAME_ATTR,
  ROUTER_ATTR,
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
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 20px;");
    expect(travel).toContain("--flemo-move-y: 600px;");
    expect(travel).toContain("--flemo-box-w: 400px");
    expect(travel).toContain("--flemo-box-h: 300px");
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

  it("paints the departure through the head, not the arrival", () => {
    // The head is the flat lead-in the compiled tiers bake in: the flight is
    // staged and running and nothing has moved yet. A zero cross-fade used to
    // mean no ghost at all, so for the length of the head the only thing on
    // glass was the arrival — the destination's contents at the departure's
    // size — and the swap the author asked to be instant happened a head early.
    // The desktop head kit, which is what puts a head on a replace: a Mac
    // WebKit session with no touch surface.
    const platform = Object.getOwnPropertyDescriptor(navigator, "platform");
    const touch = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    morphTransitionMap.set(
      "cutting" as never,
      createMorphTransition({
        name: "cutting" as never,
        initial: {},
        idle: { value: { opacity: 1 }, options: { duration: 0 } },
        enter: { value: { opacity: 1 }, options: { duration: 0.18 } },
        exit: { value: { opacity: 0 }, options: { duration: 0.18 } },
        options: { crossFade: 0, radius: true }
      })
    );
    try {
      const summary = makeScreen("layout", true);
      const pill = makeMorph(summary, [298, 24, 98, 40]);
      pill.textContent = "summary";
      attachMorph(pill, { layoutId: "pill", name: "cutting" as never, navigateStore: store });
      flipTo("REPLACING");
      summary.setAttribute(ACTIVE_ATTR, "false");

      const calendar = makeScreen("layout", true);
      const wide = makeMorph(calendar, [257, 24, 139, 40]);
      wide.textContent = "calendar";
      attachMorph(wide, { layoutId: "pill", name: "cutting" as never, navigateStore: store });

      // A copy of the departure flies, and it is the departure's own content.
      const ghost = [...layer.children].find((child) => child !== wide) as HTMLElement;
      expect(ghost.textContent).toBe("summary");
      // The desktop head for a replace is 33ms, and both ends of the hand-over
      // step at its end: the copy cuts out as the arrival cuts in, so exactly
      // one of them is ever on glass and the swap lands on the frame the box
      // starts moving.
      // And it is a STEP on both sides, not two ramps crossing: every frame
      // that renders shows exactly one of the pair.
      expect(ghost.style.animation).toContain("-fade 0.017s steps(1, start) 0.033s both");
      expect(wide.style.animation).toContain("-fade 0.017s steps(1, start) 0.033s both");
      // Held, not transparent: an arrival that paints nothing has no raster for
      // the step to promote, and the frame it fires on lands blank.
      const fade = inserted.find((rule) => rule.includes("-fade") && rule.includes("opacity: 1"))!;
      expect(fade).toMatch(/from \{\s*opacity: 0\.006;/);
      expect(fade).toMatch(/to \{\s*opacity: 1;/);
    } finally {
      morphTransitionMap.delete("cutting" as never);
      if (platform) Object.defineProperty(navigator, "platform", platform);
      if (touch) Object.defineProperty(navigator, "maxTouchPoints", touch);
      else delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
    }
  });

  it("does not force a layout for a morph with no container to be staged inside", () => {
    // Registration runs in a layout effect, in the frame React has just mutated
    // the DOM, so a measurement here is a synchronous layout of the whole page
    // at the most expensive moment there is — and it is repeated for every
    // render of every morph. The value it produces is only ever read to beat a
    // STAGED CONTAINER, so an element with none has nothing to learn from it.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 80, 80]);
    const solo = vi.spyOn(card, "getBoundingClientRect");
    attachMorph(card, { layoutId: "solo", navigateStore: store });
    expect(solo).not.toHaveBeenCalled();

    // A nested one still pays it: its own staged measurement is taken inside a
    // container already at its from-box, so it would end the interpolation on
    // the wrong size.
    const label = makeMorph(card, [28, 610, 60, 20]);
    const inside = vi.spyOn(label, "getBoundingClientRect");
    attachMorph(label, { layoutId: "nested", navigateStore: store });
    expect(inside).toHaveBeenCalled();
  });

  it("spends the head inside the travel, not in front of it", () => {
    // A head waited out as a DELAY leaves the animation uncommitted until the
    // instant it must move, so a first frame that lands late lands partway down
    // the curve and the opening is never drawn. Painted frames off a phone at
    // 60fps: the first frame the box appeared on was already 67% through its
    // travel. Baked as a flat stop, the same seconds hold the from-pose while
    // the animation is already running, and a late frame lands inside them.
    const platform = Object.getOwnPropertyDescriptor(navigator, "platform");
    const touch = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
    Object.defineProperty(navigator, "platform", { value: "MacIntel", configurable: true });
    Object.defineProperty(navigator, "maxTouchPoints", { value: 0, configurable: true });
    try {
      const summary = makeScreen("layout", true);
      const pill = makeMorph(summary, [298, 24, 98, 40]);
      attachMorph(pill, { layoutId: "headed", navigateStore: store });
      flipTo("REPLACING");
      summary.setAttribute(ACTIVE_ATTR, "false");

      const calendar = makeScreen("layout", true);
      const wide = makeMorph(calendar, [257, 24, 139, 40]);
      attachMorph(wide, { layoutId: "headed", navigateStore: store });

      // `layout` runs at 0.4s and the desktop head for a replace is 33ms, so
      // the animation is 0.433s long, starts at 0, and holds its from-pose for
      // the first 7.621% of it — the head's own length.
      expect(wide.style.animation).toContain("-travel 0.433s");
      expect(wide.style.animation).toContain("0.000s both");
      const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
      expect(travel).toContain("0%, 7.621% {");
      expect(travel).not.toContain("from {");
      // The flat stop is the from-pose and the last stop is still the
      // destination: the head holds the opening, it does not replace it.
      expect(travel).toContain("--flemo-box-w: 98px;");
      expect(travel).toContain("--flemo-box-w: 139px;");
    } finally {
      if (platform) Object.defineProperty(navigator, "platform", platform);
      if (touch) Object.defineProperty(navigator, "maxTouchPoints", touch);
      else delete (navigator as { maxTouchPoints?: number }).maxTouchPoints;
    }
  });

  it("pins a nested pair that only travels, so it cannot outrun its container", async () => {
    // The one nested case a compositor could run by itself: same size, same
    // type, only a different place inside the box. Its container travels by its
    // box and cannot be run there, so a bare transform here would advance on
    // frames the container never reached and slide the child around inside it.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 140, 20]);
    attachMorph(card, { layoutId: "card-2", navigateStore: store });
    attachMorph(label, { layoutId: "title-2", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    // Same 140x20 box as the label, moved: nothing to re-typeset, nothing to
    // resize.
    const heading = makeMorph(bigCard, [16, 260, 140, 20]);
    attachMorph(bigCard, { layoutId: "card-2", navigateStore: store });
    attachMorph(heading, { layoutId: "title-2", navigateStore: store });
    await Promise.resolve();

    const nestedRule = inserted.find((rule) => /flemo-morph-\d+n-travel/.test(rule))!;
    // Its travel rides the same channel a flying pair's box does: one
    // translation, on one clock, with room for the ascent to cancel on.
    expect(nestedRule).toContain("--flemo-move-x:");
    expect(nestedRule).not.toContain("transform:");
    expect(heading.style.translate).toContain("var(--flemo-move-x)");
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
    expect(nestedRule).toContain("--flemo-move-x: 12px;");
    expect(nestedRule).toContain("--flemo-move-y: 470px;");
    // And it BEGINS where the pair measured it — the from-delta between the
    // label's box (28, 730) and the heading's (16, 260) — decaying to rest.

    // Literal, and rightly so: this pair also carries its own size, which is
    // the main thread's work already. Pinning is for the parts a compositor
    // could otherwise run away with while the rest of the flight waits.
    expect(nestedRule).toContain("width:");
    // The arrival's stop carries to 100%, one frame early (see `arrived`).
    expect(nestedRule).toMatch(/%, 100% \{[^}]*--flemo-move-x: 0px;/);
    expect(nestedRule).not.toContain("transform:");
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

  it("carries a leading correction for a pair whose two ends already share one", () => {
    // The size moves under the leading, so the half-leading the engine renders
    // moves with it, and a leading held at its authored value would step as the
    // type grows past a boundary. The channel is emitted for the correction
    // even where there is no leading travel to carry it.
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
    const rect = (top: number, height: number) =>
      ({ top, height, left: 0, right: 0, bottom: top + height, width: 0, x: 0, y: top }) as DOMRect;
    vi.spyOn(document, "createRange").mockImplementation(
      () =>
        ({
          selectNodeContents: () => {},
          getClientRects: () => [rect(1, 18)] as unknown as DOMRectList
        }) as unknown as Range
    );

    const gallery = makeScreen("layout", true);
    // Both boxes at y 0, so the stubbed run's top IS the rendered line offset.
    const label = makeMorph(gallery, [20, 0, 119, 20]);
    label.textContent = "Thu 20:00";
    label.style.fontSize = "11px";
    label.style.lineHeight = "20px";
    Object.defineProperty(label, "offsetHeight", { value: 20, configurable: true });
    attachMorph(label, { layoutId: "meta-4", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const meta = makeMorph(detail, [16, 0, 314, 20]);
    meta.textContent = "Thu 20:00";
    meta.style.fontSize = "14px";
    meta.style.lineHeight = "20px";
    Object.defineProperty(meta, "offsetHeight", { value: 20, configurable: true });
    attachMorph(meta, { layoutId: "meta-4", name: "text", navigateStore: store });

    // Both ends read a half-leading of exactly 1, which is the boundary an
    // interpolation can only approach, so both ends take the same pixel of
    // leading and the flight renders on the step the landing will.
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("line-height: 21px");
  });

  it("cancels a growing run's drift on the tracking, beside the author's own", () => {
    // A face whose run width bows off the straight line between its ends, which
    // is what makes a title's later characters wander further than its earlier
    // ones. `system-ui` does exactly this in both engines.
    const context = {
      font: "",
      measureText: () => {
        const size = Number.parseFloat(
          context.font.split(" ").find((p) => p.endsWith("px")) ?? "0"
        );
        return {
          width: size * 4 + (size - 11) * (14 - size) * 4,
          fontBoundingBoxAscent: Math.round(size * 0.95),
          fontBoundingBoxDescent: Math.round(size * 0.25)
        };
      }
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      context as unknown as CanvasRenderingContext2D
    );

    const gallery = makeScreen("layout", true);
    const label = makeMorph(gallery, [20, 600, 119, 16]);
    label.append("Aria", document.createComment("hydration"), " Wave");
    label.style.fontFamily = "Test Sans";
    label.style.fontSize = "11px";
    label.style.lineHeight = "16px";
    attachMorph(label, { layoutId: "track-1", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const heading = makeMorph(detail, [16, 120, 314, 20]);
    heading.append("Aria", document.createComment("hydration"), " Wave");
    heading.style.fontFamily = "Test Sans";
    heading.style.fontSize = "14px";
    heading.style.lineHeight = "20px";
    attachMorph(heading, { layoutId: "track-1", name: "text", navigateStore: store });

    // The run is read from ALL of the element's text, not just its first node.
    // Two clocks on one property, so neither can be written as a plain length.
    expect(heading.style.letterSpacing).toBe("calc(var(--flemo-track) + var(--flemo-track-fix))");
    const track = inserted.find(
      (rule) => rule.startsWith("@keyframes") && rule.includes("-track {")
    )!;
    expect(track).toBeDefined();
    // Ramped, not held: what it cancels is a curve rather than a staircase.
    expect(track).not.toContain("steps(1, end)");
  });

  it("holds a text pair to one line for the whole flight", () => {
    // The flying element is the ARRIVAL's tree, so it re-wraps at every width
    // between the two ends under the arrival's rules. Where both ends are one
    // line, the widths in between have no honest reason for two: the detail's
    // meta line broke after its middle dot at the small end of every push on
    // iOS, while the cells beside it kept their ellipsis.
    const gallery = makeScreen("layout", true);
    const label = makeMorph(gallery, [20, 600, 119, 16]);
    label.textContent = "Thu 20:00 · 35,000";
    label.style.fontSize = "11px";
    label.style.lineHeight = "16px";
    attachMorph(label, { layoutId: "meta-1", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const meta = makeMorph(detail, [16, 120, 314, 20]);
    meta.textContent = "Thu 20:00 · 35,000";
    meta.style.fontSize = "14px";
    meta.style.lineHeight = "20px";
    attachMorph(meta, { layoutId: "meta-1", name: "text", navigateStore: store });

    // The departure's own appearance, held for the flight: one line, clipped
    // to the box, ellipsised where it does not fit yet.
    expect(meta.style.whiteSpace).toBe("nowrap");
    expect(meta.style.overflow).toBe("hidden");
    expect(meta.style.textOverflow).toBe("ellipsis");

    // And dropped at the landing with the rest of the flight's inline style.
    meta.dispatchEvent(animationEndEvent(`${meta.style.animation.split(" ")[0]}`));
    expect(meta.style.whiteSpace).toBe("");
  });

  it("leaves a pair that wraps at either end to its own line breaking", () => {
    // A heading that is two lines where it lands is meant to be two lines, and
    // holding it to one would clip the half the flight is carrying.
    const gallery = makeScreen("layout", true);
    const label = makeMorph(gallery, [20, 600, 119, 16]);
    label.textContent = "Thu 20:00 · 35,000";
    label.style.fontSize = "11px";
    label.style.lineHeight = "16px";
    attachMorph(label, { layoutId: "meta-2", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const meta = makeMorph(detail, [16, 120, 200, 40]);
    meta.textContent = "Thu 20:00 · 35,000";
    meta.style.fontSize = "14px";
    meta.style.lineHeight = "20px";
    attachMorph(meta, { layoutId: "meta-2", name: "text", navigateStore: store });

    expect(meta.style.whiteSpace).toBe("");
  });

  it("reads a nested arrival's line count at rest, not inside a staged container", async () => {
    // A nested arrival is measured inside a container that is ALREADY staged
    // at its from-box, so what it measures is the wrapped height — the very
    // thing the hold exists to prevent, refusing the hold on its own evidence.
    // Its registration measurement is the one taken before any container of it
    // was staged.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const label = makeMorph(card, [28, 730, 119, 16]);
    label.textContent = "Thu 20:00 · 35,000";
    label.style.fontSize = "11px";
    label.style.lineHeight = "16px";
    attachMorph(card, { layoutId: "card-2", navigateStore: store });
    attachMorph(label, { layoutId: "meta-3", name: "text", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const meta = makeMorph(bigCard, [16, 260, 314, 20]);
    meta.textContent = "Thu 20:00 · 35,000";
    meta.style.fontSize = "14px";
    meta.style.lineHeight = "20px";
    attachMorph(bigCard, { layoutId: "card-2", navigateStore: store });
    attachMorph(meta, { layoutId: "meta-3", name: "text", navigateStore: store });
    // Registered at rest; by the time the nested pass runs a microtask later
    // the container is staged small and the meta measures two lines.
    setRect(meta, 16, 260, 119, 40);
    await Promise.resolve();

    expect(meta.style.whiteSpace).toBe("nowrap");
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

  it("keeps the used line-height when the font size cannot be read", () => {
    // The factor needs a divisor. A zero or unparsable computed font-size
    // leaves the used length in place rather than stamping NaN.
    const gallery = makeScreen("layout", true);
    const cardFrom = makeMorph(gallery, [20, 600, 160, 160]);
    attachMorph(cardFrom, { layoutId: "card-lh", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const cardTo = makeMorph(detail, [0, 0, 400, 340]);
    cardTo.style.fontSize = "0px";
    cardTo.style.lineHeight = "24px";
    attachMorph(cardTo, { layoutId: "card-lh", navigateStore: store });

    expect(cardTo.parentElement).toBe(layer);
    expect(cardTo.style.lineHeight).toBe("24px");
  });

  it("falls back to the staged size when registration measured nothing", async () => {
    // A pair can register before its box has laid out (display: contents
    // parents, a first commit mid-suspension). With no rest size on record
    // the interpolation ends on the staged measurement instead.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const art = makeMorph(card, [36, 620, 64, 64]);
    attachMorph(card, { layoutId: "card-9r", navigateStore: store });
    attachMorph(art, { layoutId: "art-9r", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    const hero = makeMorph(bigCard, [16, 16, 128, 128]);
    // Registration sees an unlaid box; the flight's own measurement sees the
    // real one.
    let reads = 0;
    const laid = hero.getBoundingClientRect.bind(hero);
    hero.getBoundingClientRect = () => {
      reads += 1;
      return reads === 1 ? ({ ...laid(), width: 0, height: 0 } as DOMRect) : laid();
    };
    attachMorph(bigCard, { layoutId: "card-9r", navigateStore: store });
    attachMorph(hero, { layoutId: "art-9r", navigateStore: store });
    await Promise.resolve();

    const nestedRule = inserted.find((rule) => /flemo-morph-\d+n-travel/.test(rule))!;
    // From the captured 64px box to the STAGED 128px one, since no rest size
    // was recorded.
    expect(nestedRule).toContain("width: 64px");
    expect(nestedRule).toContain("width: 128px");
  });

  it("rides with size alone when the two ends' positions agree", async () => {
    // The travel channel stays identity when only the box differs: a size
    // change is not a reason to invent a translate.
    const gallery = makeScreen("layout", true);
    const card = makeMorph(gallery, [20, 600, 160, 160]);
    const art = makeMorph(card, [36, 620, 64, 64]);
    attachMorph(card, { layoutId: "card-8", navigateStore: store });
    attachMorph(art, { layoutId: "art-8", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const bigCard = makeMorph(detail, [0, 0, 400, 340]);
    // Same corner as the art's, bigger box: position agrees, size does not.
    const hero = makeMorph(bigCard, [36, 620, 128, 128]);
    attachMorph(bigCard, { layoutId: "card-8", navigateStore: store });
    attachMorph(hero, { layoutId: "art-8", navigateStore: store });
    await Promise.resolve();

    const nestedRule = inserted.find((rule) => /flemo-morph-\d+n-travel/.test(rule))!;
    expect(nestedRule).not.toContain("translate3d");
    expect(nestedRule).toContain("width: 64px");
    expect(nestedRule).toContain("width: 128px");
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
    // descendant is recognisable in the copy even before it registers. Its
    // copy is dimmed: the real pair flies from the captured pose, so the
    // dimmed copy is a window onto it — while a painting copy rides the
    // ghost's transform and stretches over the crisp re-typesetting
    // original, which is the smeared double title reported on a push.
    // (Dimming was once removed for "holes" — a collapsed hero, a vanished
    // title — but those were this pair's flight silently declining on a
    // zero-width destination, and the window had nothing behind it.)
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
    // Carried by the pose's coordinates rather than by a literal transform, so
    // the copy cannot be run by the compositor over a card that is not moving.
    expect(ghostRule).toContain("--flemo-pose-x:");
    expect(ghost.style.transform).toContain("var(--flemo-pose-x)");
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
    const copiedArt = ghost.querySelector<HTMLElement>("[data-copied-pair-art]");
    expect(copiedArt?.style.opacity).toBe("0");
    // But only the PAIRED copies: the unpaired remainder is the ghost's whole
    // cargo, and the copy root itself stays visible to carry it.
    expect(ghost.style.opacity).not.toBe("0");

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

    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
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

    // Out of the screen and into the layer, laid out where it LANDS and carried
    // back to the departure's box by the travel — and the screen being held a
    // width off-stage is undone before either box is computed.
    expect(hero.parentElement).toBe(layer);
    expect(hero.style.position).toBe("absolute");
    expect(hero.style.left).toBe("0px");
    // The box's SIZE is the keyframe's alone. What the element wears inline is
    // the channel that keyframe writes, never a copy of the value: a duplicate
    // only has to win once to strand the element at its departure size, and a
    // `var()` cannot, because there is only one value and the keyframe owns it.
    expect(hero.style.width).toBe("var(--flemo-box-w)");
    expect(hero.style.height).toBe("var(--flemo-box-h)");
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 20px;");
    expect(travel).toContain("--flemo-move-y: 600px;");
    expect(travel).toContain("--flemo-box-w: 80px");
    expect(travel).toContain("--flemo-box-w: 400px");
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

    expect(hero.style.minHeight).toBe("0px");
    expect(hero.style.maxHeight).toBe("none");
    // The clamps go; the box's own size is read from the channel.
    expect(hero.style.height).toBe("var(--flemo-box-h)");
    const grow = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(grow).toContain("--flemo-box-h: 80px");
    expect(grow).toContain("--flemo-box-h: 800px");

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

  // ONE FLIGHT, ONE START.
  //
  // A flight has two ends and they are not held alike. Reading only the end
  // whose transform displaces it let the layer mirror RELEASED while the other
  // end was still parked, so the morph ran alone: measured on a consumer's tab
  // switch, the button had travelled 42% of its flight before the bar's parts
  // started their cross-fade.
  it("holds the flight while EITHER of its ends is held", () => {
    const gallery = makeScreen("layout", true);
    gallery.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.PARK_UNDER);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-9", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    // The arriving side is already released; the departing side is not.
    const detail = makeScreen("layout", true);
    detail.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.RELEASED);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-9", navigateStore: store });

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.PARK_UNDER);
  });

  // The hold is written on the box that CARRIES a screen, and an end resolves
  // to the scope it was declared in. A nested Router's flight therefore has to
  // look UP for its pause rather than at the element it named.
  it("reads the hold from the nearest box above the end, not from the end itself", () => {
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-10", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const carrier = document.createElement("div");
    carrier.setAttribute(ANIM_HOLD_ATTR, ANIM_HOLD.PARK);
    document.body.appendChild(carrier);
    const detail = makeScreen("layout", true);
    carrier.appendChild(detail);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-10", navigateStore: store });

    expect(layer.getAttribute(ANIM_HOLD_ATTR)).toBe(ANIM_HOLD.PARK);
  });

  // AN EDGE THAT DOES NOT MOVE MUST NOT BE A SUM.
  //
  // A far edge reached as position PLUS size oscillates by a layout unit, and
  // everything aligned to it follows: measured on a consumer's pill whose ends
  // share a right edge at 369px, the edge ran 369, 368.987, 368.999, 368.996
  // frame after frame in both engines.
  it("places a held box from the edge itself, so the edge is never a sum", () => {
    const gallery = makeScreen("layout", true);
    const chip = makeMorph(gallery, [300, 10, 80, 32]);
    attachMorph(chip, { layoutId: "pill-1", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    // Same right edge (380), a different left one.
    const wide = makeMorph(detail, [220, 10, 160, 32]);
    attachMorph(wide, { layoutId: "pill-1", navigateStore: store });

    // Never from the layer's right: the layer is the Router's box and that box
    // changes width mid-flight when the two mounted screens take the page's
    // scrollbar away and give it back. From the EDGE, through the same channel
    // the width animates on, so the two round together — reached as position +
    // size it ran 366.000 ± 0.015, reversing six times in twenty-three frames.
    expect(wide.style.right).toBe("");
    expect(wide.style.left).toBe("calc(380px - var(--flemo-box-w))");
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 0px;");
    // And the size travels for real, because nothing here PROVED that it need
    // not: a box is only held where the arrival's own subtree has been measured
    // to land in the same places at both widths (see morphContents). Unproven
    // is the same as moving, and moving is laid out.
    expect(travel).toContain("--flemo-box-w: 160px");
    expect(travel).toContain("--flemo-box-w: 80px");
    expect(travel).not.toContain("clip-path");
  });

  it("keeps the ordinary travel where the two ends do not agree on an edge", () => {
    const gallery = makeScreen("layout", true);
    const chip = makeMorph(gallery, [300, 10, 80, 32]);
    attachMorph(chip, { layoutId: "pill-2", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const wide = makeMorph(detail, [220, 10, 150, 32]);
    attachMorph(wide, { layoutId: "pill-2", navigateStore: store });

    expect(wide.style.right).toBe("");
    expect(wide.style.left).toBe("220px");
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 80px;");
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
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-box-w: 400px");
    expect(travel).toContain("--flemo-box-w: 80px");
  });

  it("pairs against a snapshot whose leaving screen has not flipped transitional yet", () => {
    // A fast pop's container caught this: the arriving side's effect commits
    // before the leaving screen re-renders, so the partner — remembered only in
    // the snapshot, its live entry already disposed by the unmount — sits on a
    // screen still reading COMPLETED. Judged as a live entry it fails the
    // transitional gate and the pair is refused: the container never flies, its
    // camera never runs, and its children fly on their own as bare morphs. A
    // snapshot was the partner when it was captured, so its not-yet-flipped
    // status is tolerated.
    const library = makeScreen("layout", false);
    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", navigateStore: store });

    // The flip snapshots the detail's hero, then the leaving screen's status
    // lags back to COMPLETED before the arrival evaluates.
    flipTo("POPPING");
    detail.setAttribute(STATUS_ATTR, "COMPLETED");

    const thumbnail = makeMorph(library, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });

    // The pair still forms from the snapshot: the arrival flies its box from
    // the remembered big cover to its own small one.
    expect(thumbnail.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-box-w: 400px");
    expect(travel).toContain("--flemo-box-w: 80px");
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

  // A SHARED BAR is rendered as a sibling of the screen scope it belongs to, so
  // walking up from a morph inside one leaves that screen entirely — and in a
  // nested Router it lands on the ENCLOSING screen, which both ends share. The
  // side of the flight therefore cannot come from structure; the binding stamps
  // it on the element, and these two cover the shapes that broke.
  const makeBar = (host: HTMLElement, status: NavigateStatus, active: boolean) => {
    // The scope div carries the protocol; the bar is its SIBLING, inside a
    // container that carries nothing. That is the binding's own shape.
    const container = document.createElement("div");
    host.appendChild(container);
    const scope = document.createElement("div");
    scope.setAttribute(SCREEN_ATTR, "");
    scope.setAttribute(TRANSITION_ATTR, "layout");
    scope.setAttribute(STATUS_ATTR, status);
    scope.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
    setRect(scope, 0, 0, 400, 800);
    container.appendChild(scope);
    const bar = document.createElement("div");
    container.appendChild(bar);
    return bar;
  };

  const stamp = (
    element: HTMLElement,
    status: NavigateStatus,
    active: boolean,
    routerId: string
  ) => {
    element.setAttribute(TRANSITION_ATTR, "layout");
    element.setAttribute(ROUTER_ATTR, routerId);
    element.setAttribute(STATUS_ATTR, status);
    element.setAttribute(ACTIVE_ATTR, active ? "true" : "false");
  };

  it("pairs two ends that both live in shared bars, with no screen between them", () => {
    const leaving = makeMorph(makeBar(document.body, "IDLE", true), [300, 10, 80, 32]);
    stamp(leaving, "REPLACING", true, "inner");
    attachMorph(leaving, { layoutId: "header-actions", navigateStore: store });

    flipTo("REPLACING");
    stamp(leaving, "REPLACING", false, "inner");

    const arriving = makeMorph(makeBar(document.body, "REPLACING", true), [220, 10, 160, 32]);
    stamp(arriving, "REPLACING", true, "inner");
    attachMorph(arriving, { layoutId: "header-actions", navigateStore: store });

    expect(arriving.style.animation).toContain("-travel");
    expect(arriving.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.ENTER);
    expect(leaving.getAttribute(MORPH_ATTR)).toBe(MORPH_ROLE.EXIT);
  });

  it("undoes the pose of the screen a bar is measured inside, whoever owns it", () => {
    // BELONGING AND DISPLACEMENT ARE TWO QUESTIONS.
    //
    // A nested Router's bar hangs under the ENCLOSING screen, which belongs to
    // another Router and has no say over this flight's clock — that much the
    // owner answers, and declines. But `closest` walks the DOM, so a screen it
    // finds is one this element is genuinely INSIDE, and an ancestor's
    // transform displaces every rect measured under it whoever it belongs to.
    // Treating the foreign Router as "not my pose" left the arrival measured
    // with the transition's from-pose still on it and never taken off: the
    // flight was placed a whole shift out and snapped back at the landing.
    // Device-read on a consumer's tab switch, 4.28px — exactly the 1% that
    // transition slides by, and it went away when the slide was turned off.
    //
    // The two ends are measured at DIFFERENT MOMENTS — the departure when the
    // status flips, the arrival when the flight is staged — and the enclosing
    // screen takes its from-pose between them. So the rects here are what a
    // browser would actually report at each of those moments.
    const outer = makeScreen("cupertino", true);
    outer.setAttribute(ROUTER_ATTR, "outer");

    const leaving = makeMorph(makeBar(outer, "IDLE", true), [300, 10, 80, 32]);
    stamp(leaving, "REPLACING", true, "inner");
    attachMorph(leaving, { layoutId: "header-actions", navigateStore: store });

    flipTo("REPLACING");
    stamp(leaving, "REPLACING", false, "inner");

    // The enclosing screen puts its from-pose on, and everything under it is
    // painted 400px along from here.
    outer.style.transform = "translate3d(400px, 0, 0)";
    setRect(outer, 400, 0, 400, 800);

    // Deliberately NOT sharing a right edge with the departure, so this stays a
    // test of where the travel is measured rather than of the far-edge anchor.
    const arriving = makeMorph(makeBar(outer, "REPLACING", true), [620, 10, 150, 32]);
    stamp(arriving, "REPLACING", true, "inner");
    attachMorph(arriving, { layoutId: "header-actions", navigateStore: store });

    // Both ends carried back out of the 400px into rest space, so the travel is
    // the 80px between them and not the 480 a raw reading would have made it.
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 80px;");
    expect(travel).toContain("--flemo-box-w: 80px");
    expect(travel).toContain("--flemo-box-w: 150px");
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

  it("holds the departure cut until the navigation ends, not until the travel does", async () => {
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
    // The rules are dropped on the frame AFTER the landing, so the landing
    // itself carries only the restore (see `disposeOnce`).
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
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

    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toBeDefined();
    expect(travel).toContain("--flemo-move-x: 20px;");
    expect(travel).toContain("--flemo-move-y: 600px;");
    expect(travel).toContain("--flemo-box-w: 400px");
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
    //
    // Written as the camera's three coordinates rather than as a transform: the
    // element it carries travels by its box, so the camera is pinned to the same
    // thread and the transform is composed from these by style resolution.
    expect(camera).toContain("--flemo-pose-sx: 1;");
    expect(camera).toContain("--flemo-pose-x: 700px;");
    expect(camera).toContain("--flemo-pose-y: -1450px;");
    expect(camera).toContain("--flemo-pose-sx: 5;");
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
    expect(camera.indexOf("--flemo-pose-sx: 5;")).toBeLessThan(
      camera.indexOf("--flemo-pose-sx: 1;")
    );
  });

  it("registers the pose's coordinates once, not once per flight", () => {
    // A `@property` registration is document-wide, and adding one invalidates
    // style for the whole page — the single frame a flight has the least room
    // in. Two flights, one registration.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    const registrations = inserted.filter((rule) => rule.startsWith("@property"));
    expect(registrations).toHaveLength(12);

    const second = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(second, { layoutId: "photo-2", name: "zoom", navigateStore: store });

    expect(inserted.filter((rule) => rule.startsWith("@property"))).toHaveLength(12);
  });

  it("leaves the camera literal where those properties cannot be registered", () => {
    // Unregistered, they are strings to the engine: they animate discretely and
    // would jump the zoom at its midpoint. A camera that leads the card it
    // carries is a flaw; a camera that teleports halfway through is a break.
    vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation((rule: string) => {
      if (rule.startsWith("@property")) throw new Error("unknown at-rule");
      inserted.push(rule);
      return 0;
    });

    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", name: "zoom", navigateStore: store });
    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");
    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "photo-1", name: "zoom", navigateStore: store });

    const camera = inserted.find((rule) => rule.includes("-camera {"))!;
    expect(camera).toContain("transform: none");
    expect(camera).toContain("scale(5)");
    expect(camera).not.toContain("--flemo-pose");
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

  it("carries a square pair's corner as a proportion of its box", () => {
    // 12px on a 48px thumb is a quarter-round corner; 12px on the 346px hero
    // it becomes is barely a bevel. Interpolated in px the ROUNDNESS the eye
    // reads collapses in the flight's first tenth — reported as "the radius
    // snaps to 0 and then the morph starts". A percentage resolves against
    // the animated box every frame, so the proportion is what interpolates.
    const gallery = makeScreen("layout", true);
    const thumb = makeMorph(gallery, [20, 600, 48, 48]);
    thumb.style.borderRadius = "12px";
    attachMorph(thumb, { layoutId: "sq-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 346, 346]);
    hero.style.borderRadius = "0px";
    attachMorph(hero, { layoutId: "sq-1", navigateStore: store });

    const rule = inserted.find((r) => /flemo-morph-\d+i-paint/.test(r))!;
    expect(rule).toContain("border-radius: 25.00%");
    expect(rule).toContain("border-radius: 0.00%");
  });

  it("leaves an elliptical or keyword radius on the px channel", () => {
    // A slash radius is per-axis and a keyword is not a length; neither can
    // convert to one percentage per corner, so both stay exactly as captured.
    const gallery = makeScreen("layout", true);
    const thumb = makeMorph(gallery, [20, 600, 48, 48]);
    thumb.style.borderRadius = "12px / 6px";
    attachMorph(thumb, { layoutId: "sq-3", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 346, 346]);
    hero.style.borderRadius = "0px";
    attachMorph(hero, { layoutId: "sq-3", navigateStore: store });

    const rule = inserted.find((r) => /flemo-morph-\d+i-paint/.test(r))!;
    expect(rule).toContain("border-radius: 12px / 6px");
    // The corner itself carries no percentage; the keyframe's own stops do.
    expect(rule.replace(/^\s*[\d.]+%(, 100%)? \{$/gm, "")).not.toContain("%");
  });

  it("leaves a non-length radius component alone as well", () => {
    // One end already a percentage (or any non-px token): there is no px pair
    // to convert, so the channel carries the captured values verbatim.
    const gallery = makeScreen("layout", true);
    const thumb = makeMorph(gallery, [20, 600, 48, 48]);
    thumb.style.borderRadius = "10%";
    attachMorph(thumb, { layoutId: "sq-4", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 346, 346]);
    hero.style.borderRadius = "0px";
    attachMorph(hero, { layoutId: "sq-4", navigateStore: store });

    const rule = inserted.find((r) => /flemo-morph-\d+i-paint/.test(r))!;
    expect(rule).toContain("border-radius: 10%");
    expect(rule).toContain("border-radius: 0px");
  });

  it("keeps each corner's own proportion in a per-corner radius", () => {
    // A card whose image rounds only its top computes "16px 16px 0px 0px";
    // every corner converts against its own box so the straight bottom stays
    // straight while the top eases.
    const gallery = makeScreen("layout", true);
    const thumb = makeMorph(gallery, [20, 600, 160, 160]);
    thumb.style.borderRadius = "16px 16px 0px 0px";
    attachMorph(thumb, { layoutId: "sq-2", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 400]);
    hero.style.borderRadius = "0px";
    attachMorph(hero, { layoutId: "sq-2", navigateStore: store });

    const rule = inserted.find((r) => /flemo-morph-\d+i-paint/.test(r))!;
    expect(rule).toContain("border-radius: 10.00% 10.00% 0.00% 0.00%");
    expect(rule).toContain("border-radius: 0.00%");
  });

  it("carries the scrollport's clip into the flight", () => {
    // The cell sits at the list's bottom edge with 30 of its 80px scrolled
    // under the chrome stacked there. Bare, the hidden strip paints on the
    // flight's first frame and the element crosses the tab bar whole; carried
    // as an inset it slides out from under the edge instead.
    const gallery = makeScreen("layout", true);
    const scroller = document.createElement("div");
    scroller.style.overflowY = "auto";
    setRect(scroller, 0, 600, 400, 100);
    gallery.appendChild(scroller);
    const cell = document.createElement("div");
    scroller.appendChild(cell);
    setRect(cell, 20, 650, 80, 80);
    attachMorph(cell, { layoutId: "clip-1", navigateStore: store });

    flipTo("PUSHING");
    gallery.setAttribute(ACTIVE_ATTR, "false");

    const detail = makeScreen("layout", true);
    const hero = makeMorph(detail, [0, 0, 400, 300]);
    attachMorph(hero, { layoutId: "clip-1", navigateStore: store });

    const rule = inserted.find((r) => /flemo-morph-\d+i-travel/.test(r))!;
    expect(rule).toContain("clip-path: inset(0.00% 0.00% 37.50% 0.00%)");
    expect(rule).toContain("clip-path: inset(0.00% 0.00% 0.00% 0.00%)");
    // The ghost is a copy of the same departure, clipped the same way.
    const ghostRule = inserted.find((r) => /flemo-morph-\d+g-travel/.test(r))!;
    expect(ghostRule).toContain("inset(0.00% 0.00% 37.50% 0.00%)");
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
    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
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

  it("sweeps a corpse left in the layer at the next navigation", () => {
    // An interrupted storm (a tab switch tearing the home screen down while a
    // card's nested morphs are still in the air) strands a role-bearing element
    // in the layer: connected, still `enter`, its flight already gone from the
    // map. `isFlightPartner` reads any role-bearing element as a partner already
    // in the air, so a corpse pairs against every later pop instead of the grid
    // — no camera, the texts blinking — until the next navigation clears it.
    const corpse = document.createElement("div");
    corpse.setAttribute(MORPH_ATTR, MORPH_ROLE.ENTER);
    corpse.setAttribute("data-flemo-morph-name", "layout");
    layer.appendChild(corpse);
    // A role-less element the layer legitimately holds (a ghost drops its role
    // at birth) must survive.
    const ghost = document.createElement("div");
    layer.appendChild(ghost);

    // Any navigation's capture sweeps the layer first.
    const gallery = makeScreen("layout", true);
    const thumbnail = makeMorph(gallery, [20, 600, 80, 80]);
    attachMorph(thumbnail, { layoutId: "photo-1", navigateStore: store });
    flipTo("PUSHING");

    expect(corpse.isConnected).toBe(false);
    expect(ghost.isConnected).toBe(true);
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
      // authored translate ADDED to the measured travel, since both are
      // translations on one clock and the move channel carries them together.
      expect(hero.style.animation).toContain("-travel 0.500s");
      expect(hero.style.animation).toContain("0.050s both");
      expect(hero.style.animation).toContain("-fade 0.125s");
      const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
      expect(travel).toContain("--flemo-move-x: 60px;");
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

      const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
      expect(travel).toContain("--flemo-move-x: 20px;");
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
      ["left top", "--flemo-pose-x: 0px;\n    --flemo-pose-y: 0px;"],
      ["10px 20px", "--flemo-pose-x:"],
      ["nonsense", "--flemo-pose-x:"]
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

    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 20px;");
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
      expect(inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n")).toContain(
        "--flemo-box-w: 400px"
      );
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

    const travel = inserted.filter((rule) => /-travel|-size/.test(rule)).join("\n");
    expect(travel).toContain("--flemo-move-x: 20px;");
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
      expect(inserted.find((rule) => rule.includes("-travel"))).toContain("--flemo-move-x: 20px;");
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

  it("reads a screen's transform-origin however it is written", async () => {
    // A percentage read as a length would put the camera's anchor 50px from the
    // corner of an 800px screen — a zoom toward the wrong place. jsdom hands
    // back the specified value rather than resolving it, which is exactly the
    // environment the keyword and single-token forms have to survive.
    for (const [origin, expected] of [
      ["left top", "--flemo-pose-x: 0px;\n    --flemo-pose-y: 0px;"],
      ["left", "--flemo-pose-x: 0px;"],
      ["nonsense nonsense", "--flemo-pose-x:"]
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
      expect(inserted.find((rule) => rule.includes("-camera {"))).toContain("--flemo-pose-sx: 4;");
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
    expect(inserted.find((rule) => rule.includes("-travel"))).toContain("--flemo-move-x: 20px;");
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

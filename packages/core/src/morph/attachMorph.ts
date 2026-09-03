import {
  TRANSITIONAL_STATUS_VALUES,
  type NavigateStatus,
  type NavigateStoreApi
} from "@navigate/store";

import type { AnimationOptions, TransitionTarget } from "@transition/cssTypes";
import type { TransitionVariant } from "@transition/typing";

import {
  ACTIVE_ATTR,
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  attrSelector,
  MORPH_ATTR,
  MORPH_CAMERA_ATTR,
  MORPH_GHOST_ATTR,
  MORPH_NAME_ATTR,
  MORPH_ROLE,
  MORPH_SLOT_ATTR,
  MORPH_STAND_IN_ATTR,
  PART_NAME_ATTR,
  STATUS_ATTR,
  SCREEN_ATTR,
  attrValueSelector
} from "@dom/attributes";

import { intoLayerSpace, preserveAnimations } from "@dom/staging";

import { clipTravel, visibleInset } from "@morph/morphClip";
import {
  captureMorphSnapshot,
  isSingleLine,
  followPose,
  readElementPose,
  untransformedCentre,
  untransformRect,
  type MorphSnapshot
} from "@morph/morphGeometry";

import { buildCameraKeyframes, buildMorphKeyframes, contentDecls } from "@morph/morphKeyframes";

import { resolveMorphLayer } from "@morph/morphLayer";
import { holdOneLine, holdsOneLine, leadingBias, leadingStops } from "@morph/morphLine";
import { paintTravel } from "@morph/morphPaint";

import { IDENTITY_POSE, resolvePose } from "@morph/morphPose";

import { ensurePinnedPoses, insertMorphRules } from "@morph/morphSheet";
import { headSeconds, resolveMorphSide } from "@morph/morphSide";

import { morphTransitionMap } from "@transition/morphTransition/morphTransition";
import {
  DEFAULT_MORPH_TRANSITION_NAME,
  MORPH_FROM_VARIANT,
  type MorphTransition,
  type MorphTransitionName
} from "@transition/morphTransition/typing";

// THE MORPH RUNTIME.
//
// A morph is one element that exists on both screens of a flight under the same
// `layoutId`. This module pairs the two, moves the arriving one into the FLIGHT
// LAYER, and hands the travel to the compositor as CSS — then puts it back.
//
// Why it leaves its screen at all: a screen CLIPS its descendants (flemo's own
// scope is a scroll container by default), COVERS what it replaces, and DRAGS
// its contents along when the transition slides. All three would hide or cut a
// travelling element, and all three are properties of being a DESCENDANT — so
// for the length of the flight it stops being one. That is also what makes a
// morph independent of which screen transition is flying: there is no screen
// motion left underneath it to cancel or compose with.
//
// It runs no frame loop and holds no clock: the flight's timing comes from the
// compiled hold the screens already obey — the layer mirrors the arriving
// screen's hold attribute, so the same `animation-play-state` rule pauses the
// element and the release flip starts it on the same frame as its screen.
//
// It is framework-neutral by construction. A binding hands it an element and a
// `layoutId`; everything else — which screen the element is on, which
// transition is flying, whether this side is arriving or departing — is read
// from the DOM PROTOCOL, which every binding renders anyway.
//
// THE CONTRACT A BINDING MUST KEEP: call `attachMorph` before the browser
// paints the frame in which the element mounts, and call it again when the
// element's screen changes status. React's `useLayoutEffect`, Solid's
// `onMount`, and a Svelte action all sit in that window.

export interface AttachMorphOptions {
  /** The pairing key. Two elements sharing it across a flight are one thing moving. */
  layoutId: string | number;
  /** A registered morph transition. Defaults to the built-in `shared` preset. */
  name?: MorphTransitionName;
  /** The navigate store of the Router scope this element belongs to. */
  navigateStore: NavigateStoreApi;
}

interface MorphEntry {
  element: HTMLElement;
  layoutId: string;
  name: MorphTransitionName;
  /**
   * The element's box AT REST, measured at registration — before any container
   * it is nested in is staged. A binding registers child-first, so this is the
   * natural arrival layout. It is what a nested size interpolation must END
   * on: the staged measurement is taken inside a container still at its
   * from-box, and a container whose width interpolates lays the child out
   * slightly small there — the flight then froze 40px short and snapped the
   * difference at the landing.
   */
  restSize: { width: number; height: number } | null;
}

interface MorphFlight {
  finish: () => void;
  /** The element in the air, so a morph nested inside it can find its clock. */
  element: HTMLElement;
  duration: number;
  start: number;
  ease: AnimationOptions["ease"];
  /**
   * Put the landing's safety net away, and set it again.
   *
   * A flight lands on its travel's own `animationend`, and the backstop exists
   * for the ones that never get one — a screen frozen mid-air, a tab
   * backgrounded before the compositor reports back. It is armed for the
   * flight's own length, which is the right guess for a flight on a clock and
   * the wrong one for a flight on a FINGER: a drag that takes longer than the
   * animation would have is not stuck, it is being held, and landing it there
   * puts the element back in its screen mid-gesture. So a gesture puts the net
   * away while it drives, and sets it again for the release it hands back.
   */
  suspendBackstop: () => void;
  armBackstop: (seconds: number) => void;
}

interface MorphScope {
  entries: Map<HTMLElement, MorphEntry>;
  /**
   * Elements a landed flight is still holding — the element it CUT, and the
   * screen it drove as a camera — and how to let each go.
   *
   * A cut outlives the travel that wrote it (see `releaseDeparture`), which
   * means it can still be on an element when the NEXT flight picks that same
   * element up — a pop interrupting a push flies the very card the push had
   * just cut. A flight records the inline style it found so it can put it back
   * at the landing, so a cut left in that style comes home with it and the
   * element lands invisible. One cut per element, and a new flight supersedes
   * the old one.
   */
  residue: Map<HTMLElement, () => void>;
  /** The last rest pose of each `layoutId`, taken the instant a flight began. */
  snapshots: Map<string, { snapshot: MorphSnapshot; element: HTMLElement }>;
  flights: Map<string, MorphFlight>;
  /**
   * `layoutId`s a GESTURE already delivered, waiting for the navigation it
   * committed to catch up.
   *
   * A swipe stages its own flights and plays them out on release; the
   * navigation that release commits then stages as usual and normally finds
   * them still in the air, which `already-flying` declines. A FAST flick
   * breaks that: the release settle is scaled to what is left, so a gesture
   * carried to the far edge lands in ~120ms while the navigation arrives at
   * ~150ms — and by then the flights map is empty, so the same element is
   * staged again from its ORIGINAL rest pose and makes the whole trip a
   * second time. Measured: land at 149ms, a fresh `start` at 150ms, landing
   * again 723ms later.
   *
   * A delivery is consumed by the first stage that would have re-flown it, so
   * one gesture suppresses exactly one navigation's worth of staging.
   */
  delivered: Set<string>;
  unsubscribe: () => void;
}

const scopes = new WeakMap<NavigateStoreApi, MorphScope>();

let flightSequence = 0;

const SCREEN_SELECTOR = attrSelector(SCREEN_ATTR);

// Properties a hoisted element would otherwise INHERIT from the subtree it
// left. Its own rules travel with it (they are its own), but everything
// cascading in from an ancestor does not — and a shared element that changes
// typeface halfway through its flight is not a shared element.
const INHERITED = [
  "color",
  "font",
  "letterSpacing",
  "lineHeight",
  "textAlign",
  "textTransform",
  "whiteSpace",
  "direction"
] as const;

// What actually gets stamped for an inherited property. One property needs
// translating rather than copying: computed `line-height` comes back as a USED
// length, and stamping that length inline hands every descendant an absolute
// leading where the tree they left gave them a factor. Measured on a paired
// card: rows that set only a 13px font sat 20px tall at rest and 24px tall in
// flight, because the card's own used 24px landed on them verbatim (the `font`
// shorthand carries the same length, which is why `lineHeight` stamps after it
// and wins). The RATIO reproduces the element's own leading exactly and keeps
// a descendant's leading proportional to its own font, which is what unitless
// inheritance — the common case — was doing before the element was hoisted.
// A descendant that inherited an absolute leading from an ancestor with a
// DIFFERENT font size trades one distortion for a smaller one.
const inheritedValue = (computed: CSSStyleDeclaration, property: (typeof INHERITED)[number]) => {
  if (property !== "lineHeight") return computed[property];
  const raw = computed.lineHeight ?? "";
  const lineHeight = Number.parseFloat(raw);
  const fontSize = Number.parseFloat(computed.fontSize ?? "");
  if (!raw.endsWith("px") || !Number.isFinite(lineHeight)) return raw;
  if (!Number.isFinite(fontSize) || fontSize <= 0) return raw;
  return String(Math.round((lineHeight / fontSize) * 10000) / 10000);
};

const isTransitional = (status: NavigateStatus): boolean =>
  (TRANSITIONAL_STATUS_VALUES as readonly string[]).includes(status);

const closestScreen = (element: HTMLElement): HTMLElement | null =>
  element.closest<HTMLElement>(SCREEN_SELECTOR);

/**
 * Which value of `data-flemo-active` marks the screen a flight is going TO.
 *
 * NOT always `"true"`. The active flag follows the STACK, not the direction of
 * travel: on a pop the screen being dismissed is still the top one and keeps
 * `"true"` until it lands, while the screen underneath — the one the user is
 * returning to — carries `"false"`. It is the same axis the transition variants
 * use (`POPPING-true` is cupertino's `enterBack`, the screen leaving to the
 * right), so reading it as "the arrival" pairs a morph backwards on every pop.
 */
const arrivingActive = (status: NavigateStatus): string =>
  status === "POPPING" ? "false" : "true";

const isArriving = (screen: HTMLElement, status: NavigateStatus): boolean =>
  screen.getAttribute(ACTIVE_ATTR) === arrivingActive(status);

/** The variant the arriving side of a flight animates under, and its partner's. */
const flightVariants = (
  status: NavigateStatus
): { enter: TransitionVariant; exit: TransitionVariant } =>
  status === "POPPING"
    ? { enter: "POPPING-false", exit: "POPPING-true" }
    : {
        enter: `${status}-true` as TransitionVariant,
        exit: `${status}-false` as TransitionVariant
      };

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

// A pair of ends worth interpolating: both sides have a value, and they differ
// by enough to be worth a channel in the keyframe.
const channel = (
  from: number | null,
  to: number | null,
  epsilon: number
): { from: number; to: number } | null =>
  from !== null && to !== null && Math.abs(from - to) >= epsilon ? { from, to } : null;

// TYPE has three dimensions and a morph has to carry all three. Size alone
// leaves the element wearing its destination's WEIGHT and TRACKING from the
// first frame: the type thickens in one step and then merely gets bigger,
// which is a swap dressed up as a growth. With all three the text re-typesets
// at every size on the way, which is what "it grows" means for words.
interface TypeFace {
  fontSize: number | null;
  fontWeight: number | null;
  letterSpacing: number | null;
  wordSpacing: number | null;
  lineHeight: number | null;
  textHeight: number | null;
  leadOffset: number | null;
}

const typeTravel = (
  from: TypeFace,
  to: TypeFace,
  font: { family: string; weight: string | number; style: string } | null,
  ease: AnimationOptions["ease"]
) => {
  const fontSize = channel(from.fontSize, to.fontSize, 0.5);
  const leading = channel(from.lineHeight, to.lineHeight, 0.25);
  // THE STAIRCASE FIRST, where the engine's face height turns out to climb one.
  // It holds the rendered leading at ONE value for the whole flight, which is
  // strictly more than the bias below can do, so the bias stands aside for it.
  const stairs = fontSize ? leadingStops(from, to, font, ease) : null;
  // Owed only where the rendered half-leading MOVES, which is a leading that
  // interpolates or a size that does underneath one that does not. Both ends
  // take the same amount, so what the flight travels is unchanged and only the
  // pixel of half-leading it renders in moves (see morphLine).
  const bias = stairs === null && (fontSize || leading) ? leadingBias(from, to) : 0;
  return {
    fontSize,
    leading: stairs,
    // A variable font takes every weight between; a static family snaps to the
    // faces it has. Both are better than starting at the destination's.
    fontWeight: channel(from.fontWeight, to.fontWeight, 1),
    letterSpacing: channel(from.letterSpacing, to.letterSpacing, 0.01),
    wordSpacing: channel(from.wordSpacing, to.wordSpacing, 0.01),
    // A leading the two ends already share still gets a channel when there is a
    // bias to carry: the size moves under it, and a leading held at its
    // authored value would step as the type grows past a pixel boundary.
    // The ascent's staircase rides with the leading's -- the same stops, read
    // for their other half. The emitter refuses it where the set writes a
    // transform of its own for it to fight with.
    lift: stairs,
    lineHeight: leading
      ? { from: leading.from + bias, to: leading.to + bias }
      : bias !== 0 && to.lineHeight !== null
        ? { from: to.lineHeight + bias, to: to.lineHeight + bias }
        : null
  };
};

// One frame at 60Hz: long enough to be an animation, short enough to read as
// the cut it is.
const CUT_SECONDS = 1 / 60;

// What a morph runs for when the screen transition it rides has no duration to
// lend it (`none`).
const DEFAULT_MORPH_SECONDS = 0.4;

/** How many morphs an element sits inside — its stacking order on the layer. */
const morphDepth = (element: HTMLElement): number => {
  let depth = 0;
  let node: HTMLElement | null = element;
  while (node) {
    if (node.hasAttribute(MORPH_ATTR)) depth += 1;
    node = node.parentElement;
  }
  return depth;
};

// A morph's from-value comes from its OWN table, not the screen one: the
// arriving side always starts at `initial` and the departing side always starts
// at rest, whichever status brought the pair together (see MORPH_FROM_VARIANT).
const resolveMorphMotion = (
  transition: MorphTransition,
  variant: TransitionVariant
): { from: TransitionTarget; to: TransitionTarget; options: AnimationOptions } | null => {
  const fromKey = MORPH_FROM_VARIANT[variant];
  if (fromKey === "self") return null;
  const target = transition.variants[variant];
  return {
    from: fromKey === "initial" ? transition.initial : transition.variants["IDLE-true"].value,
    to: target.value,
    options: target.options
  };
};

// The layer's BOX belongs to the binding — only a Router knows whether it is
// the viewport (a root Router) or a contained region (a nested one), and a
// fixed layer inside a contained region would fly its element out of the box.
// What the runtime insists on is the rest: nothing on the layer may take
// pointer input, and it has to paint above the screens it stages over.
const prepareLayer = (layer: HTMLElement) => {
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "2147483000";
};

// One component of a computed `transform-origin`. A browser resolves it to px,
// but not every environment does (jsdom hands back the specified `50% 50%`),
// and a percentage read as a length puts the camera's anchor 50px from the
// corner of an 800px screen — a zoom toward the wrong place, and one that a
// test would have to know to look for.
const ORIGIN_KEYWORDS: Record<string, number> = {
  left: 0,
  top: 0,
  center: 0.5,
  right: 1,
  bottom: 1
};

const originOffset = (token: string | undefined, extent: number): number => {
  if (!token) return extent / 2;
  const keyword = ORIGIN_KEYWORDS[token];
  if (keyword !== undefined) return keyword * extent;
  const value = Number.parseFloat(token);
  if (!Number.isFinite(value)) return extent / 2;
  return token.endsWith("%") ? (value / 100) * extent : value;
};

/**
 * A screen's `transform-origin` in the flight layer's coordinates.
 *
 * Read rather than assumed: the camera's translate is solved against whatever
 * point the screen actually scales about, so a consumer who moved it does not
 * get a background that zooms toward the wrong corner. The screen's own box is
 * un-posed first — it may already be carrying its transition's from-pose.
 */
const screenTransformOrigin = (
  screen: HTMLElement,
  layer: HTMLElement
): { x: number; y: number } => {
  const painted = screen.getBoundingClientRect();
  const paintedRect = {
    x: painted.left,
    y: painted.top,
    width: painted.width,
    height: painted.height
  };
  const pose = readElementPose(screen);
  const rest = untransformRect(paintedRect, pose, untransformedCentre(paintedRect, pose));
  const box = intoLayerSpace(rest, layer);
  const styles = typeof getComputedStyle === "function" ? getComputedStyle(screen) : null;
  const parts = (styles?.transformOrigin ?? "").trim().split(/\s+/);
  return {
    x: box.x + originOffset(parts[0], box.width),
    y: box.y + originOffset(parts[1], box.height)
  };
};

// A keyframe set can ask the element to wear a declaration: a pinned travel
// animates the position's coordinates and a pinned pose animates the pose's, and
// neither is any use without the property that reads them. One place, so a
// riding pair and a flying one cannot drift apart on it.
const wear = (
  element: HTMLElement,
  set: { translate: string | null; transform: string | null }
) => {
  if (set.translate) element.style.translate = set.translate;
  if (set.transform) element.style.transform = set.transform;
};

const startFlight = (
  scope: MorphScope,
  entry: MorphEntry,
  captured: { snapshot: MorphSnapshot; element: HTMLElement },
  status: NavigateStatus,
  screen: HTMLElement | null,
  store: NavigateStoreApi,
  carrying: MorphFlight | null
): void => {
  const transition =
    morphTransitionMap.get(entry.name) ?? morphTransitionMap.get(DEFAULT_MORPH_TRANSITION_NAME);
  if (!transition) return;

  const { enter: enterVariant, exit: exitVariant } = flightVariants(status);
  const enterMotion = resolveMorphMotion(transition, enterVariant);
  if (!enterMotion) return;

  // Supersede any cut still held on either side of the new pair, BEFORE
  // anything is measured or recorded: the element about to fly must not carry
  // a previous flight's hidden state into the style this one will restore, and
  // the element about to be cut must not be under two cuts with two owners.
  scope.residue.get(entry.element)?.();
  scope.residue.get(captured.element)?.();

  const side = screen
    ? resolveMorphSide(entry.element, screen, enterVariant)
    : (() => {
        const own = captureMorphSnapshot(entry.element);
        return {
          rect: own.rect,
          fontSize: own.fontSize,
          fontWeight: own.fontWeight,
          letterSpacing: own.letterSpacing,
          wordSpacing: own.wordSpacing,
          lineHeight: own.lineHeight,
          aspectRatio: own.aspectRatio,
          padding: own.padding,
          margin: own.margin,
          paint: own.paint,
          singleLine: own.singleLine,
          textHeight: own.textHeight,
          leadOffset: own.leadOffset,
          // Nested: the container is the flight, and it is the container that
          // shares (or does not share) a moving screen's clock.
          screenMoves: false,
          screenDuration: carrying!.duration,
          screenEase: carrying!.ease
        };
      })();
  if (side.rect.width <= 0 || side.rect.height <= 0) {
    return;
  }
  if (captured.snapshot.rect.width <= 0 || captured.snapshot.rect.height <= 0) {
    return;
  }

  const layer = resolveMorphLayer(store);
  const home = entry.element.parentElement;
  /* v8 ignore next 4 -- neither is reachable from a browser: the layer falls
     back to a document-level element when a binding publishes none, and a
     registered element that reached the pairing is in the tree. The guard is
     for SSR and for a binding that registers a detached node. */
  if (!layer || !home) {
    return;
  }

  // A morph authors no timing of its own in the built-in preset, so it inherits
  // the flying screen's: the shared element then lands with its screen under
  // ANY transition, which is the whole point of not owning one.
  // A screen transition with no clock of its own (`none`, an instant replace)
  // must not silently take the morph down with it: the shared element is the
  // whole point of the navigation, and an author who wanted nothing to move
  // would not have paired one. Fall back to the preset's own length.
  const duration = enterMotion.options.duration ?? side.screenDuration;
  const flightDuration = carrying
    ? carrying.duration
    : duration > 0
      ? duration
      : DEFAULT_MORPH_SECONDS;
  // WHOSE CURVE THE TRAVEL RUNS ON.
  //
  // The morph's own, normally: a screen's fade can be front-loaded to get
  // itself out of the way early, and a travel borrowed from that curve would
  // snap the element across and leave it sitting there (see `shared`).
  //
  // The SCREEN'S, when the screen's transition moves it. A morph's destination
  // is a place ON the arriving screen, so a screen that slides or rises in
  // carries that place with it: the element is chasing a moving target, and
  // chasing it on a second clock leaves the two disagreeing in both position
  // and size. Measured on a cupertino pop, at the same point in the flight:
  //
  //   two clocks:  the element falls from 75px behind its place to 118px
  //                behind before turning round, and is still 160px too wide
  //   one clock:   61px behind and closing, 149px too wide and closing —
  //                monotone on both axes, and closer on both at every sample
  //
  // On one clock the gap is `(start − end)(1 − curve)`: two fixed ends scaled
  // by one curve, so it closes without ever changing sign.
  const ease =
    side.screenMoves && side.screenEase
      ? side.screenEase
      : (enterMotion.options.ease ?? side.screenEase);
  const start = carrying ? carrying.start : (enterMotion.options.delay ?? 0) + headSeconds(status);

  prepareLayer(layer);
  const destination = intoLayerSpace(side.rect, layer);
  const origin = intoLayerSpace(captured.snapshot.rect, layer);
  const box = { width: destination.width, height: destination.height };
  // WHAT THE ARRIVAL IS AT REST, not what it is right now.
  //
  // A NESTED arrival is measured inside a container that is already staged at
  // its from-box, so its measured height is the height it takes at the SMALL
  // end — two lines, where the hold is exactly what would have prevented them.
  // Its registration measurement is the one taken before any container of it
  // was staged (see MorphEntry.restSize).
  const arrivalOneLine =
    entry.element.firstElementChild === null && entry.restSize
      ? isSingleLine(entry.restSize.height, side.lineHeight, side.fontSize)
      : side.singleLine;
  const crossFade = clamp01(transition.crossFade ?? 0.55);
  // The face the flight wears. Its height is what the leading is measured
  // against, and on Blink it is quantised; the ratios come off a canvas rather
  // than a layout probe, once per face for the session (see morphFace).
  const face =
    typeof getComputedStyle === "function"
      ? (() => {
          const cs = getComputedStyle(entry.element);
          return cs.fontFamily
            ? { family: cs.fontFamily, weight: cs.fontWeight, style: cs.fontStyle }
            : null;
        })()
      : null;
  const type = typeTravel(captured.snapshot, side, face, ease);
  // Everything else the two ends paint differently, from the table rather than
  // from a branch per property (see morphPaint). `radius: false` is how a morph
  // transition opts one out — the `text` preset does, because type has no
  // corner worth moving.
  const paint = paintTravel(
    captured.snapshot.paint,
    side.paint,
    transition.radius === false ? new Set(["border-radius"]) : undefined
  );
  // THE CORNER TRAVELS AS A PROPORTION when the box changes size enough for
  // px to lie. Interpolating 12px → 0px is linear in px, but the box under it
  // grows severalfold at the same time, so the ROUNDNESS the eye reads —
  // radius over side — collapses in the first tenth of the flight: measured
  // on a 48px thumb opening to a 346px hero, the ratio fell 25% → 10% inside
  // 90ms, which is reported as "the radius snaps to 0 and then the morph
  // starts". As a percentage the browser resolves the radius against the box
  // every frame, so a quarter-round thumb stays proportionally round and
  // straightens over the whole flight instead of at its first step.
  //
  // Only for a pair that is SQUARE-ish at both ends, because a percentage
  // radius is per-axis (width horizontally, height vertically): on a box far
  // from square it bends the corner elliptical, and on one whose aspect is
  // also morphing (a list row opening into a page) the mid-flight ellipse is
  // its own artifact — measured as a 16px card corner ballooning to 8×54.
  // Those keep the px interpolation.
  const corner = paint.find((channel) => channel.property === "border-radius");
  if (corner) {
    // Per-component: a card whose image rounds only its top corners computes
    // to "16px 16px 0px 0px", and each corner keeps its own proportion.
    const pxList = (value: string): number[] | null => {
      if (value.includes("/")) return null;
      const parts = value.trim().split(/\s+/);
      const numbers: number[] = [];
      for (const part of parts) {
        const match = /^(\d+(?:\.\d+)?)px$/.exec(part);
        if (!match) return null;
        numbers.push(Number(match[1]));
      }
      // Trimmed input splits to at least one part, and a computed radius
      // never carries more than four: the browser normalises an invalid
      // shorthand away before this code can see it.
      return numbers;
    };
    const squarish = (rect: { width: number; height: number }): boolean =>
      rect.width > 0 && rect.height > 0 && Math.abs(rect.width / rect.height - 1) <= 0.1;
    const fromPx = pxList(corner.from);
    const toPx = pxList(corner.to);
    if (fromPx && toPx && squarish(captured.snapshot.rect) && squarish(side.rect)) {
      const pct = (values: number[], span: number): string =>
        values.map((value) => `${((value / span) * 100).toFixed(2)}%`).join(" ");
      corner.from = pct(fromPx, captured.snapshot.rect.width);
      corner.to = pct(toPx, side.rect.width);
    }
  }

  // WHAT THE SCROLLPORT WAS HIDING at each end rides the flight as a clip.
  // A cell scrolled to the list's edge is half covered by the chrome stacked
  // against that edge; staged bare it becomes whole in one frame and crosses
  // the tab bar it was under — reported from a scrolled grid as the morph
  // "overlapping the tab bar and the header". Measured from each end's own
  // clipping ancestors, so the element leaves by sliding out from under the
  // chrome and lands by sliding back beneath it (see morphClip). Nested pairs
  // are not given one: their container clips them itself.
  const edgeClip = clipTravel(visibleInset(captured.element), visibleInset(entry.element));

  const id = `${(flightSequence += 1)}`;

  // THE BOX travels, not a scale.
  //
  // Scaling an element stretches everything inside it: type becomes a blown-up
  // bitmap and the contents cannot find their own places at any size but the
  // last one. Animating the box lets the subtree lay itself out at every size
  // on the way, which is the difference between an element that GROWS and a
  // picture of one being zoomed. It costs layout per frame on this one subtree,
  // which is the honest price of the thing actually being laid out.
  // The travel's position rides registered properties: a literal `translate` is
  // run by WebKit's compositor even beside the size it belongs to, and a
  // position that runs ahead of its own size is a line of type arriving late.
  // Where they cannot be registered it goes back to `left` and `top`.
  const travelPinned = ensurePinnedPoses();

  const arriving = buildMorphKeyframes({
    id: `${id}i`,
    travel: {
      from: IDENTITY_POSE,
      authoredFrom: resolvePose(enterMotion.from, box) ?? IDENTITY_POSE,
      authoredTo: resolvePose(enterMotion.to, box) ?? IDENTITY_POSE,
      duration: flightDuration,
      start,
      ease
    },
    box: { from: origin, to: destination },
    clip: edgeClip,
    // The spacing travels too. Without it the arrival wears its OWN padding
    // from the first frame, so the contents it is handing over from flinch in
    // or out by the difference at the exact moment of the tap.
    padding:
      captured.snapshot.padding !== side.padding
        ? { from: captured.snapshot.padding, to: side.padding }
        : null,
    // Type grows instead of being scaled: size, weight and tracking all
    // interpolated, so the words re-typeset on the way rather than being
    // re-sized into a face they were already wearing.
    fontSize: type.fontSize,
    fontWeight: type.fontWeight,
    letterSpacing: type.letterSpacing,
    wordSpacing: type.wordSpacing,
    lineHeight: type.lineHeight,
    leading: type.leading,
    lift: type.lift,
    travelPinned,
    // The arrival fades only if the author gave it an entry pose to fade from.
    // The presets do not: the arrival is opaque and the ghost dissolves on top
    // of it, because fading both bleeds the background through the pair.
    fade:
      contentDecls(enterMotion.from).length > 0
        ? { from: enterMotion.from, to: enterMotion.to, duration: flightDuration * crossFade }
        : null,
    paint
  });

  // ONE FLIGHT, ONE THREAD.
  //
  // The parts of a flight are placed relative to each other, so they have to be
  // drawn on the same frames. The element itself travels by its BOX, which no
  // compositor can interpolate, so those frames are the main thread's; anything
  // else here that is a bare transform would be run by the compositor instead
  // and would advance on frames the element never reached. Measured on the
  // playground with the main thread blocked mid-flight: the ghost and the camera
  // both kept moving over a card that had stopped.
  //
  // So the principal decides, and every part follows it (see morphPose for what
  // pinning is and why nothing cheaper works). Where the registrations cannot be
  // made, nothing is pinned: a part that leads is a flaw, and a part animating an
  // unregistered property would teleport at its midpoint instead.
  const pinned = !arriving.geometryAccelerated && ensurePinnedPoses();

  // The element left behind. It does not travel — the arrival starts on top of
  // it — so all it does is hand over while the two are still co-located.
  const partner = captured.element;
  const exitMotion = resolveMorphMotion(transition, exitVariant);
  /* v8 ignore next 2 -- the pairing already guarantees all three: it declines a
     disconnected partner, never pairs an element with itself, and every
     transitional variant resolves an exit motion. */
  const departing =
    partner.isConnected && partner !== entry.element && exitMotion
      ? buildMorphKeyframes({
          id: `${id}o`,
          travel: {
            from: IDENTITY_POSE,
            authoredFrom: IDENTITY_POSE,
            authoredTo: IDENTITY_POSE,
            duration: flightDuration,
            start,
            ease
          },
          // CUT FROM THE FIRST FRAME, not over a window.
          //
          // The departure is the one party to a flight that does not travel: it
          // rides the screen it belongs to. The flight does not. So the instant
          // that screen starts moving they are two different places, and
          // anything still painting at the old one is a second copy of the card
          // sliding away from the real one.
          //
          // It used to be cut over a window one frame wide, on the reasoning
          // that a frame is too short to see. It is — until a frame is missed.
          // Measured on desktop Safari: a main-thread hitch inside that window
          // (36ms between two rAF callbacks) leaves the cut's opacity at the
          // stale value the main thread last committed while the screen's
          // transform, which the compositor owns, has already carried the
          // element 15px away. What lands on glass is one frame of a
          // half-opaque card offset from the flight — the "blade" beside the
          // element, reported on both push and pop. Amplifying the window to
          // 250ms reproduces it on every flight, in every engine, which is what
          // identified it.
          //
          // A window that can be missed cannot be made short enough; it has to
          // not exist. Both ends of the fade are the exit's END pose, so the
          // backwards fill hides the departure from the moment the flight is
          // staged — before the head, before any motion — and no stale sample
          // can reveal it.
          //
          // Nothing is lost by hiding it that early: for the whole flight the
          // departure sits underneath the flyer, and under the GHOST, which is
          // a copy of it painting the departure's own content at exactly that
          // box. The one case it is not covered is an arrival the author gave
          // an entry fade to WITHOUT a cross-fade — and that case already sees
          // through it for every frame after the first, so this changes the
          // head, not the behaviour.
          fade: { from: exitMotion.to, to: exitMotion.to, duration: CUT_SECONDS, delay: 0 },
          paint: []
        })
      : null;

  // NESTED: the container is already carrying this element's BOX — it is inside
  // it, and the box is being laid out at every size on the way. What the
  // container cannot do for it is TYPE: font-size is not layout, so a heading
  // paired with a list label has to grow into it on its own. That is the whole
  // nested job, and it is why nothing here is staged or moved.
  if (carrying) {
    // WHERE THE FLIGHT BEGINS is part of the pair's contract for a nested
    // element too. Riding alone renders it at the ARRIVAL's own place inside
    // the travelling box from the first frame, so any difference between the
    // two ends' local arrangement — an inset kept on the element at one end
    // and on an ancestor at the other, a different gap under the artwork —
    // was a lurch at the tap: measured at 20px sideways on the playground's
    // caption, and at 16px on the demo it replaced, so it was never a
    // regression, just never corrected. The correction is a translate from
    // the measured from-delta to identity on the flight's own curve: exact at
    // both ends, first-order in between, and the ride itself is untouched.
    // `side.rect` is this element measured where the staged container put it,
    // so the delta is against the box actually on glass at frame zero.
    const dx = captured.snapshot.rect.x - side.rect.x;
    const dy = captured.snapshot.rect.y - side.rect.y;
    const travels = Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5;
    // The SIZE half of the same correction. Riding sizes the child through the
    // container's width interpolation, and that works only when the width
    // actually interpolates: a container that starts at destination width (a
    // full-width list row becoming a page) lays the child out full-size on
    // frame one, and a thumbnail spreads into a strip instead of growing.
    // `side.rect` is measured where the staged container put it, so the delta
    // is zero exactly when the container's width carries the child correctly,
    // which keeps this channel silent for a grid cell.
    // The size interpolation ENDS on the rest measurement from registration,
    // not on the staged one: staged is measured inside a container still at
    // its from-box, and when the container's width interpolates the child is
    // laid out slightly small there. Ending on staged froze the artwork 40px
    // short of the page and snapped the difference at the landing.
    const endSize = entry.restSize ?? { width: side.rect.width, height: side.rect.height };
    const dw = captured.snapshot.rect.width - endSize.width;
    const dh = captured.snapshot.rect.height - endSize.height;
    // NOT for type. A re-typesetting pair moves by FONT SIZE and its box is
    // its layout's business: a block heading measures the full content width,
    // and forcing that width onto the row's label reflowed the flex row every
    // frame — the price rode the animated width across the card and the label
    // read as entering from the right. The size channel exists for elements
    // whose box IS the thing (the artwork), which never re-typeset.
    const resizes = type.fontSize === null && (Math.abs(dw) >= 1 || Math.abs(dh) >= 1);
    const retypes =
      type.fontSize !== null ||
      type.fontWeight !== null ||
      type.letterSpacing !== null ||
      type.wordSpacing !== null ||
      type.lineHeight !== null;
    // SHAPE, not just size. A square thumbnail becoming a 4:3 hero has to pass
    // through the ratios between, or it snaps to its destination's proportions
    // on the first frame and only the box around it grows — which is the
    // "it does not scale proportionally" everyone sees and nobody can name.
    const reshapes =
      captured.snapshot.aspectRatio !== null &&
      side.aspectRatio !== null &&
      captured.snapshot.aspectRatio !== side.aspectRatio;
    const respaces =
      captured.snapshot.padding !== side.padding || captured.snapshot.margin !== side.margin;
    // A nested element gets the paint table too. It used to get none of it:
    // its corner, its surface and its border were the destination's from the
    // first frame, which is the same step the container was already fixed for.
    if (!retypes && !reshapes && !respaces && !travels && !resizes && paint.length === 0) {
      return;
    }

    const growing = buildMorphKeyframes({
      id: `${id}n`,
      travel: {
        from: travels ? { ...IDENTITY_POSE, x: dx, y: dy } : IDENTITY_POSE,
        authoredFrom: IDENTITY_POSE,
        authoredTo: IDENTITY_POSE,
        duration: flightDuration,
        start,
        ease
      },
      fontSize: type.fontSize,
      fontWeight: type.fontWeight,
      letterSpacing: type.letterSpacing,
      wordSpacing: type.wordSpacing,
      lineHeight: type.lineHeight,
      leading: type.leading,
      lift: type.lift,
      travelPinned,
      aspectRatio: reshapes
        ? { from: captured.snapshot.aspectRatio!, to: side.aspectRatio! }
        : null,
      // Same reason as the container's padding: a nested element sits where
      // its ARRIVAL's margins put it from the first frame otherwise.
      padding:
        captured.snapshot.padding !== side.padding
          ? { from: captured.snapshot.padding, to: side.padding }
          : null,
      margin:
        captured.snapshot.margin !== side.margin
          ? { from: captured.snapshot.margin, to: side.margin }
          : null,
      size: resizes
        ? {
            from: {
              width: captured.snapshot.rect.width,
              height: captured.snapshot.rect.height
            },
            to: endSize
          }
        : null,
      fade: null,
      paint,
      pinned
    });
    const disposeNested = insertMorphRules(growing.rules);
    const inlineNested = entry.element.getAttribute("style");
    entry.element.style.animation = growing.animation;
    wear(entry.element, growing);
    // As above: a nested pair re-typesets on its container's clock, at every
    // width the container passes through.
    if (holdsOneLine(captured.snapshot.singleLine, arrivalOneLine)) holdOneLine(entry.element);
    entry.element.setAttribute(MORPH_ATTR, MORPH_ROLE.ENTER);

    let grown = false;
    const finishNested = () => {
      /* v8 ignore next -- the listener is removed and the net cleared on the
         first landing; the guard is for a second caller racing the first. */
      if (grown) return;
      grown = true;
      entry.element.removeEventListener("animationend", onGrown);
      clearTimeout(nestedBackstop);
      if (inlineNested === null) entry.element.removeAttribute("style");
      else entry.element.setAttribute("style", inlineNested);
      entry.element.setAttribute(MORPH_ATTR, "");
      disposeNested();
      scope.flights.delete(entry.layoutId);
    };
    function onGrown(event: AnimationEvent) {
      if (event.animationName !== growing.geometryName) return;
      // Same rule as the container's landing: an end that ran for no time is a
      // rebuilt animation, not a finished one (see `onEnd`).
      if (flightDuration > 0 && event.elapsedTime === 0) {
        return;
      }
      finishNested();
    }
    const nestedNet = (seconds: number) =>
      setTimeout(
        () => {
          finishNested();
        },
        seconds * 1000 + 250
      );
    let nestedBackstop = nestedNet(start + flightDuration);
    entry.element.addEventListener("animationend", onGrown);
    scope.flights.set(entry.layoutId, {
      finish: finishNested,
      element: entry.element,
      duration: flightDuration,
      start,
      ease,
      suspendBackstop: () => clearTimeout(nestedBackstop),
      armBackstop: (seconds: number) => {
        clearTimeout(nestedBackstop);
        nestedBackstop = nestedNet(seconds);
      }
    });
    return;
  }

  // THE GHOST: a copy of the element being replaced, carried along inside the
  // flight.
  //
  // Without it the travelling box can only ever show the ARRIVAL's content, at
  // the departure's size — a list card blown up to a detail panel leaves a void
  // where the panel's text would be, and a detail panel shrunk to a list card
  // crushes type that was never laid out at that size. With it, the flight
  // starts as an exact copy of what was on glass and dissolves into the real
  // element while the box travels, which is the whole trick every platform
  // container transform is doing.
  //
  // Nested morphs get none of this: their container's ghost already carries
  // them, and a second copy inside it would be the same pixels twice.
  const ghost =
    crossFade > 0 && partner.isConnected ? (partner.cloneNode(true) as HTMLElement) : null;
  const ghostSet = ghost
    ? buildMorphKeyframes({
        id: `${id}g`,
        travel: {
          // The copy FOLLOWS, it does not re-lay out. It keeps the layout it
          // was captured with and is carried onto the arrival's box by a
          // transform — because a copy that re-wraps its own text while the
          // real element re-wraps differently prints the two over each other,
          // which is exactly the doubled title on any card with a long one.
          from: IDENTITY_POSE,
          to: followPose(destination, origin),
          authoredFrom: IDENTITY_POSE,
          authoredTo: IDENTITY_POSE,
          duration: flightDuration,
          start,
          ease
        },
        // The copy is clipped exactly as the departure was, releasing (or
        // gathering) with the flight, so it too emerges from under the chrome
        // rather than popping whole over it.
        clip: edgeClip,
        fade: { from: { opacity: 1 }, to: { opacity: 0 }, duration: flightDuration * crossFade },
        // The GHOST is a copy of the departure and never re-lays itself out, so
        // it holds the departure's own paint for its whole (short) life.
        paint: [],
        // And it is the plainest case of a part that must not lead: a copy of
        // the card printed over the card.
        pinned
      })
    : null;

  // THE CAMERA. `carry: "screen"` turns the flight into a container transform:
  // the screen the element is SMALL on is zoomed by exactly the amount that
  // takes the element from one end of the flight to the other, so everything
  // else on it is dragged along and pushed out of frame.
  //
  // Which screen that is follows the SIZES, not the direction: on a push the
  // grid is the screen being left, on a pop it is the one being returned to,
  // and in both cases it is the one holding the smaller box. So the same rule
  // reads correctly both ways — the camera always lives with the grid, and it
  // always animates between resting and zoomed-in-on-this-element.
  //
  // Nested morphs never carry: their container is already the camera's subject.
  const settling = destination.width * destination.height < origin.width * origin.height;
  const cameraScreen =
    transition.carry === "screen" && !carrying
      ? settling
        ? screen
        : closestScreen(partner)
      : null;
  const camera =
    cameraScreen && origin.width > 0 && destination.width > 0
      ? buildCameraKeyframes({
          id: `${id}c`,
          origin: screenTransformOrigin(cameraScreen, layer),
          small: settling ? destination : origin,
          big: settling ? origin : destination,
          settling,
          duration: flightDuration,
          start,
          ease,
          selector: attrValueSelector(MORPH_CAMERA_ATTR, `${id}c`),
          // The camera is the largest part of all: it carries a whole screen.
          // It follows the same decision as everything else in the flight.
          accelerated: !pinned
        })
      : null;

  const disposeRules = insertMorphRules([
    ...arriving.rules,
    /* v8 ignore start -- see the guard on `departing` above: every flight the
       pairing produces has one. */
    ...(departing?.rules ?? []),
    /* v8 ignore stop */
    ...(ghostSet?.rules ?? []),
    ...(camera?.rules ?? [])
  ]);
  if (cameraScreen && camera) {
    // Supersede whatever a previous flight left on this screen before stamping
    // ours: two cameras on one screen is two authors of one transform.
    scope.residue.get(cameraScreen)?.();
    cameraScreen.setAttribute(MORPH_CAMERA_ATTR, `${id}c`);
  }

  const computedBefore =
    typeof getComputedStyle === "function" ? getComputedStyle(entry.element) : null;

  // Hold the element's PLACE with a COPY OF IT, not with a box the size of it.
  //
  // The screen it leaves has to lay out exactly as it will at rest, or the
  // landing has nowhere true to land and the surrounding content reflows twice
  // — once when the element goes and once when it comes back. A placeholder
  // measured in pixels gets that almost right, and "almost" is a layout shift
  // with a morph's exact timing: WebKit-measured, a card inside an
  // `inline-block` button left its `<li>` 6.31px taller for the whole flight,
  // because an EMPTY block gives the button no baseline to synthesise from and
  // the line box then adds the strut's descender. Chromium adds that space at
  // rest too, so it never moved there and the bug was invisible on it.
  //
  // A copy of the element cannot be got wrong: the layout has no way to tell
  // it apart from what was there. It also costs less than it looks — the size,
  // the display, the margins and the baseline all come for free, and the three
  // inline overrides that used to approximate them are gone.
  const standIn = entry.element.cloneNode(true) as HTMLElement;
  for (const node of [standIn, ...standIn.querySelectorAll<HTMLElement>("*")]) {
    // Not a morph, not a part, and not FINDABLE: a duplicate id, name or test
    // id breaks the page it was copied from — label associations, form
    // submissions, and every query a consumer's own tests make.
    node.removeAttribute(MORPH_ATTR);
    node.removeAttribute(MORPH_NAME_ATTR);
    node.removeAttribute(MORPH_SLOT_ATTR);
    node.removeAttribute(PART_NAME_ATTR);
    node.removeAttribute("id");
    node.removeAttribute("name");
    node.removeAttribute("data-testid");
    node.style.removeProperty("animation");
  }
  standIn.setAttribute(MORPH_STAND_IN_ATTR, "");
  standIn.setAttribute("aria-hidden", "true");
  standIn.inert = true;
  // It holds space and nothing else. `visibility` rather than `opacity`: an
  // opacity of 0 still paints, and this is under the element that replaced it.
  standIn.style.visibility = "hidden";
  standIn.style.pointerEvents = "none";
  home.insertBefore(standIn, entry.element);

  const inline = entry.element.getAttribute("style");
  const computed = computedBefore;
  const inherited = computed
    ? INHERITED.map((property) => [property, inheritedValue(computed, property)] as const)
    : [];

  preserveAnimations(entry.element, () => layer.appendChild(entry.element));
  for (const [property, value] of inherited) entry.element.style[property] = value;
  entry.element.style.position = "absolute";
  // Laid out where it LANDS, and carried back to where it started by the
  // travel's own `translate`. A position that comes from layout is painted at
  // whole pixels on Blink, and a line of type stepping a pixel at a time is the
  // tremor this whole channel exists to avoid (see morphKeyframes).
  // Laid out where it LANDS whenever the travel carries it back, and where it
  // STARTS when it does not. The emitter decides which, and says so by handing
  // back a `translate` for the element to wear.
  const laidOutAt = arriving.translate ? destination : origin;
  entry.element.style.left = `${laidOutAt.x}px`;
  entry.element.style.top = `${laidOutAt.y}px`;
  entry.element.style.width = `${origin.width}px`;
  entry.element.style.height = `${origin.height}px`;
  entry.element.style.margin = "0";
  // A CLAMP outranks the animation. `min-height: 100%` on the destination —
  // the ordinary way to write an element that fills its screen — pins the
  // flyer at full height from the first frame, and the growth the morph is
  // there to show never happens. The clamps describe where the element RESTS;
  // they are restored with the rest of the inline style at the landing.
  entry.element.style.minWidth = "0";
  entry.element.style.minHeight = "0";
  entry.element.style.maxWidth = "none";
  entry.element.style.maxHeight = "none";
  // Layout is what is being animated, so keep it inside this subtree.
  entry.element.style.contain = "layout";
  entry.element.style.willChange = "left, top, width, height";
  // NESTED morphs stack by depth. A card and the title inside it are two
  // flights on one layer, and DOM order alone would put whichever registered
  // last on top — which is the parent, because a binding's mount effects run
  // child-first. Depth is measured before the parent leaves, so the child is
  // still inside it.
  entry.element.style.zIndex = `${morphDepth(home) + 1}`;
  entry.element.style.animation = arriving.animation;
  wear(entry.element, arriving);
  // Both ends are one line, so every width in between is one line too. Without
  // this the arrival's own wrapping rules run at the departure's width and put
  // a second line under the first for the opening frames (see morphLine).
  if (holdsOneLine(captured.snapshot.singleLine, arrivalOneLine)) holdOneLine(entry.element);
  entry.element.setAttribute(MORPH_ATTR, MORPH_ROLE.ENTER);

  if (ghost && ghostSet) {
    // A copy must not be able to pass for the original. It is stripped of every
    // marker the runtime, the compiled rules or devtools would read as a morph,
    // and of the attributes that make an element FINDABLE — ids, names, test
    // ids — because a duplicate of those breaks the page it was copied from:
    // label associations, form submissions and every query a consumer's own
    // tests make. It is inert and hidden from assistive technology on top.
    for (const node of [ghost, ...ghost.querySelectorAll<HTMLElement>("*")]) {
      // PAIRED descendants stop painting in the copy. The real pair is staged
      // in the flight at the captured pose — the exact spot the copy would
      // have painted — so the dimmed copy is a WINDOW onto the real element,
      // not a hole. Printing the copy as well puts two nearly identical
      // things in one place: the copy rides the ghost's TRANSFORM, so type
      // in it stretches toward the destination box as a smeared bitmap over
      // the crisp re-typesetting original — reported as the title "bleeding"
      // on a push. The copy keeps its space (its job is holding the
      // departure's layout together for the unpaired content around it).
      //
      // This dimming was removed once, on the diagnosis that the copy was a
      // hole: artwork read as a hero collapsing to a strip, type read as the
      // title vanishing at the tap. Both were real, and both were THIS pair's
      // flight having silently DECLINED (a zero-width destination, measured
      // while a sibling's staged size squeezed it), so nothing was underneath
      // the window. With no real flight, a hidden copy IS a hole; the fix
      // belonged to the declined flight, not to the ghost.
      if (node !== ghost && node.hasAttribute(MORPH_ATTR)) node.style.opacity = "0";
      node.removeAttribute(MORPH_ATTR);
      node.removeAttribute(MORPH_NAME_ATTR);
      // A part carries its own status, so the copy would run the departing
      // screen's choreography a second time — an entrance replaying inside an
      // afterimage. The copy holds still and fades; that is its whole job.
      node.removeAttribute(PART_NAME_ATTR);
      node.removeAttribute("id");
      node.removeAttribute("name");
      node.removeAttribute("data-testid");
    }
    ghost.setAttribute(MORPH_GHOST_ATTR, "");
    ghost.setAttribute("aria-hidden", "true");
    ghost.inert = true;
    // The copy's own SURFACE is the element that is morphing, and that surface
    // is already being drawn underneath — a copy of it on top is a lid over the
    // real thing. What the copy is for is the content with no counterpart on
    // the other side: it holds that content in the arrangement it was captured
    // in and fades it out. So it keeps its box and paints nothing itself.
    ghost.style.background = "none";
    ghost.style.boxShadow = "none";
    ghost.style.borderColor = "transparent";
    for (const [property, value] of inherited) ghost.style[property] = value;
    ghost.style.position = "absolute";
    ghost.style.left = `${origin.x}px`;
    ghost.style.top = `${origin.y}px`;
    ghost.style.width = `${origin.width}px`;
    ghost.style.height = `${origin.height}px`;
    ghost.style.margin = "0";
    ghost.style.minWidth = "0";
    ghost.style.minHeight = "0";
    ghost.style.maxWidth = "none";
    ghost.style.maxHeight = "none";
    ghost.style.pointerEvents = "none";
    ghost.style.willChange = "left, top, width, height";
    ghost.style.contain = "layout";
    ghost.style.zIndex = `${morphDepth(home) + 2}`;
    ghost.style.animation = ghostSet.animation;
    wear(ghost, ghostSet);
    layer.appendChild(ghost);
  }

  /* v8 ignore next -- as above: `departing` exists for every paired flight. */
  if (departing) {
    partner.style.setProperty("animation", departing.animation);
    partner.setAttribute(MORPH_ATTR, MORPH_ROLE.EXIT);
  }

  // LIFTING THE CUT is not the landing's business.
  //
  // The departure is cut, not faded, and the cut fills BOTH ways: it pins the
  // element at hidden for as long as it is applied. Lifting it when the travel
  // ends assumes the screen it belongs to is already gone by then, and usually
  // it is — the flight borrows the screen's own clock. But it does not have to
  // be. A screen transition with no motion of its own (`none`) is spanned by
  // whatever else the author gave that screen — a `<Part>`'s choreography —
  // and that span can outlast the flight. For those frames the element the
  // user just watched fly away comes BACK, at full size, in the middle of a
  // screen that is about to vanish.
  //
  // So the cut is lifted when the FLIGHT is over, not when the travel is: the
  // first non-transitional status, or the element leaving the document.
  //
  // And the cut is only as real as its KEYFRAMES: this flight's rules are
  // dropped from the per-flight sheet at the landing, and an `animation`
  // naming keyframes that no longer exist animates nothing at all. Dropping
  // them is therefore part of lifting the cut, not part of landing.
  // The CAMERA is held on exactly the same terms, and for exactly the same
  // reason: it holds its screen at the end of the zoom, and dropping it early
  // snaps the whole background back while that screen is still on glass.
  let unwatchResidue: (() => void) | null = null;
  let disposed = false;
  const disposeOnce = () => {
    /* v8 ignore next -- the landing and the residue release can both reach it,
       and dropping a flight's rules twice would take the next flight's. */
    if (disposed) return;
    disposed = true;
    disposeRules();
  };
  const release = () => {
    unwatchResidue?.();
    unwatchResidue = null;
    if (scope.residue.get(partner) === release) scope.residue.delete(partner);
    /* v8 ignore next -- as above. */
    if (departing) {
      partner.style.removeProperty("animation");
      partner.setAttribute(MORPH_ATTR, "");
    }
    if (cameraScreen) {
      if (scope.residue.get(cameraScreen) === release) scope.residue.delete(cameraScreen);
      /* v8 ignore next 2 -- a camera marker that is not this flight's belongs
         to the flight that superseded it, and is that flight's to remove. */
      if (cameraScreen.getAttribute(MORPH_CAMERA_ATTR) === `${id}c`)
        cameraScreen.removeAttribute(MORPH_CAMERA_ATTR);
    }
    disposeOnce();
  };
  const releaseResidue = () => {
    if (!partner.isConnected || !isTransitional(store.getState().status)) {
      release();
      return;
    }
    /* v8 ignore next -- as above. */
    if (departing) scope.residue.set(partner, release);
    if (cameraScreen && camera) scope.residue.set(cameraScreen, release);
    unwatchResidue = store.subscribe((state) => {
      if (isTransitional(state.status)) return;
      release();
    });
    // A screen that is still transitional when its store goes quiet — an
    // aborted navigation, a scope torn down mid-flight — would keep the
    // element hidden (and the background zoomed) forever otherwise.
    const stranded = setTimeout(release, (start + flightDuration) * 1000 + 1000);
    const unsubscribe = unwatchResidue;
    unwatchResidue = () => {
      clearTimeout(stranded);
      unsubscribe();
    };
  };

  // The layer is outside the screen, so the compiled hold rule cannot reach the
  // element through it. Mirroring the arriving screen's hold attribute puts the
  // element back under the same pause, which is what keeps a morph starting on
  // the same frame as the screen carrying it instead of on a clock of its own.
  const mirrorHold = () => {
    layer.setAttribute(ANIM_HOLD_ATTR, screen?.getAttribute(ANIM_HOLD_ATTR) ?? ANIM_HOLD.RELEASED);
  };
  mirrorHold();
  const holdWatch =
    typeof MutationObserver === "function" ? new MutationObserver(mirrorHold) : null;
  if (screen) holdWatch?.observe(screen, { attributes: true, attributeFilter: [ANIM_HOLD_ATTR] });

  let landed = false;
  const finish = () => {
    /* v8 ignore next -- the travel's end and the backstop race; whichever
       arrives second must not restore the element twice. */
    if (landed) return;
    landed = true;
    entry.element.removeEventListener("animationend", onEnd);
    clearTimeout(backstop);
    holdWatch?.disconnect();
    layer.removeAttribute(ANIM_HOLD_ATTR);

    // Home again, and exactly as it was: the element carries no trace of the
    // flight, so what the consumer laid out is what remains.
    if (inline === null) entry.element.removeAttribute("style");
    else entry.element.setAttribute("style", inline);
    if (home.isConnected)
      preserveAnimations(entry.element, () => standIn.replaceWith(entry.element));
    else entry.element.remove();
    standIn.remove();
    entry.element.setAttribute(MORPH_ATTR, "");

    ghost?.remove();
    // The departure's cut outlives the travel, and so must the keyframes it is
    // written in; `releaseDeparture` drops them when it lifts the cut.
    /* v8 ignore next 2 -- as above: the cut always outlives the travel, so the
       rules are always dropped by the residue rather than by the landing. */
    if (departing || cameraScreen) releaseResidue();
    else disposeOnce();
    scope.flights.delete(entry.layoutId);
  };
  function onEnd(event: AnimationEvent) {
    if (event.animationName !== arriving.geometryName) return;
    // AN END THAT RAN FOR NO TIME IS NOT A LANDING.
    //
    // `elapsedTime` is how long the animation actually ran, and a real landing
    // reports the flight's own duration. Zero means the animation was torn
    // down and rebuilt rather than finished — WebKit reports that as an end,
    // not a cancel, and it arrives with the keyframes, the name and the
    // duration all still intact, so nothing else about the event tells the two
    // apart. Measured on desktop Safari: every animation of a flight ending
    // together ~7ms after the release, each with `elapsedTime: 0`, the
    // departure's cut then restarting from zero and running normally — while
    // the flight, having been landed by the first of those ends, was already
    // home. What that looks like is a morph that never happened under a screen
    // transition that did.
    //
    // Ignoring it costs nothing: if the animation was rebuilt it lands on its
    // own end a moment later (that is what the departure's cut demonstrates),
    // and if it was not, the backstop still brings the element home. Landing on
    // it, on the other hand, is unrecoverable — the element is back in its
    // screen before it has moved a pixel.
    if (flightDuration > 0 && event.elapsedTime === 0) {
      return;
    }
    finish();
  }
  // The travel's own end is the landing. The backstop covers the flights that
  // never get one — a screen frozen mid-air, a tab backgrounded before the
  // compositor reports back — because a morph that never lands leaves the
  // element in the layer, outside the tree its consumer wrote.
  const net = (seconds: number) =>
    setTimeout(
      () => {
        finish();
      },
      seconds * 1000 + 250
    );
  let backstop = net(start + flightDuration);
  entry.element.addEventListener("animationend", onEnd);

  scope.flights.set(entry.layoutId, {
    finish,
    element: entry.element,
    duration: flightDuration,
    start,
    ease,
    suspendBackstop: () => clearTimeout(backstop),
    armBackstop: (seconds: number) => {
      clearTimeout(backstop);
      backstop = net(seconds);
    }
  });
};

/**
 * Is this element the OTHER SIDE of the flight that is starting?
 *
 * A `layoutId` is a NAME, not an address. The same one legitimately sits on
 * several screens of a stack — a list card on screen A, the same card opened
 * on screen B — and pairing by name alone lets a navigation between two
 * entirely different screens reach down and grab one of them. Two failures came
 * out of that, and they look nothing alike from the outside:
 *
 * - a morph running on a navigation that has no shared element in it, pairing
 *   one screen's card with a card two screens down;
 * - an element staged at a rect measured on a screen that no longer exists,
 *   appearing full size in the middle of nowhere before its own screen has
 *   arrived, because snapshots outlive the screens they were taken from.
 *
 * So a partner has to be ON the flight: still in the document, and on a screen
 * that is transitioning right now, on the side the arrival is not. A deep
 * resting screen pins its status to COMPLETED (the binding does this for every
 * stacked screen), which is exactly the discriminator.
 *
 * No screen at all is allowed and is not a loophole: it means either persistent
 * chrome that lives outside the screens, or an element already hoisted into the
 * flight layer by a flight this one is interrupting. Both are real partners.
 */
const isFlightPartner = (
  element: HTMLElement,
  status: NavigateStatus,
  // A GESTURE has no navigation behind it. The status requirement below exists
  // to stop a pair forming across screens that are merely stacked — two entries
  // of the same route deep in a stack, say — and for a flight driven by a
  // status flip the screens carrying that status ARE the two taking part. A
  // drag has no such flip: the screens sit at rest under the finger. What still
  // holds is the side test, which is the half that identifies the pair, so that
  // is what a gesture is checked on.
  gesture = false
): boolean => {
  if (!element.isConnected) return false;
  const screen = closestScreen(element);
  if (!screen) return true;
  if (!gesture && !isTransitional(screen.getAttribute(STATUS_ATTR) as NavigateStatus)) return false;
  return screen.getAttribute(ACTIVE_ATTR) !== arrivingActive(status);
};

/**
 * The other side of a pair, measured NOW.
 *
 * The sweep at the flip (see `capture`) is the best moment to measure — the
 * departing element is exactly where the user last saw it — but it is not the
 * only one, and it is not guaranteed to have happened. Two things race it:
 *
 * - Nothing orders the store's subscribers. The sweep runs from one, the
 *   binding's re-render from another; a binding that re-renders synchronously
 *   inside the notification (React's `useSyncExternalStore` does exactly this
 *   for an external store) runs the arriving element's layout effect BEFORE
 *   the sweep, and the arrival then looks for a snapshot that has not been
 *   taken yet.
 * - A screen whose morphs mount after the flip was not in the sweep at all.
 *
 * Both used to end the same way: no snapshot, no pair, and a screen
 * transition with no morph in it — intermittent by construction and
 * impossible to ask for on purpose.
 *
 * Measuring late is a fallback, not a substitute: the partner may by then be
 * held at its screen's from-pose. Which is exactly what `resolveMorphSide`
 * undoes, so a late measurement lands in the same rest space as an early one.
 */
const measurePartnerNow = (
  scope: MorphScope,
  entry: MorphEntry,
  status: NavigateStatus,
  gesture = false
): { snapshot: MorphSnapshot; element: HTMLElement } | null => {
  for (const candidate of scope.entries.values()) {
    if (candidate.element === entry.element) continue;
    if (candidate.layoutId !== entry.layoutId) continue;
    if (!isFlightPartner(candidate.element, status, gesture)) continue;
    const partnerScreen = closestScreen(candidate.element);
    // Off-screen (already in the flight layer): what it is wearing IS where it
    // is, and there is no screen pose to undo.
    if (!partnerScreen) {
      return { snapshot: captureMorphSnapshot(candidate.element), element: candidate.element };
    }
    const side = resolveMorphSide(candidate.element, partnerScreen, flightVariants(status).exit);
    return {
      snapshot: {
        rect: side.rect,
        fontSize: side.fontSize,
        fontWeight: side.fontWeight,
        letterSpacing: side.letterSpacing,
        wordSpacing: side.wordSpacing,
        lineHeight: side.lineHeight,
        aspectRatio: side.aspectRatio,
        padding: side.padding,
        margin: side.margin,
        paint: side.paint,
        singleLine: side.singleLine,
        textHeight: side.textHeight,
        leadOffset: side.leadOffset
      },
      element: candidate.element
    };
  }
  return null;
};

const MORPH_SELECTOR = attrSelector(MORPH_ATTR);

const evaluate = (
  scope: MorphScope,
  store: NavigateStoreApi,
  entry: MorphEntry,
  deferred = false,
  // A DRAG has no status to read. A swipe stages its flights before the
  // navigation exists — that is the whole point of an interactive one — so the
  // direction is passed in instead of inferred from the store. Everything
  // downstream (which side arrives, which variant each end animates under)
  // already takes the status as an argument, so this is the only place that
  // has to know the difference.
  forcedStatus?: NavigateStatus
): void => {
  const status = forcedStatus ?? store.getState().status;
  if (!forcedStatus && !isTransitional(status)) {
    return;
  }
  if (scope.flights.has(entry.layoutId)) {
    // The gesture's flight is still in the air and this navigation is riding
    // it, so the delivery mark has done its job and must not outlive it.
    scope.delivered.delete(entry.layoutId);
    return;
  }

  // A morph INSIDE another morph rides it.
  //
  // Letting both fly independently is what tears a card apart mid-flight: the
  // card, the artwork and the title each match their own partner exactly at
  // both ends, but they get there on their own curves and their own anchors,
  // so between the ends the artwork drifts out of the card and the title
  // floats. Composition beats independence here — a container is the unit the
  // eye is following, and its contents belong to it for the trip.
  //
  // The check has to wait one microtask: a binding mounts effects child-first,
  // so at the child's own registration its parent has not started (or declined)
  // a flight yet. A microtask still lands before paint, so the from-pose is in
  // place for the first frame either way.
  // A morph INSIDE another morph rides it, and does not fly on its own.
  //
  // Both alternatives were tried on glass and both fail. Letting the child fly
  // free tears the container apart in the air. Correcting for the container's
  // transform so the child keeps its own path holds the container together but
  // breaks its INSIDE: the box is scaled from its own layout while the children
  // are placed by their own paths, so the spacing between them stops matching
  // and voids open up where the content used to be.
  //
  // Riding keeps the container a faithful scaled copy of itself, and the GHOST
  // (see below) is what covers the difference between the two ends' contents.
  // That is the shape every platform's container transform has.
  //
  // The check waits one microtask: a binding mounts effects child-first, so at
  // the child's registration its container has not yet started (or declined) a
  // flight. A microtask still lands before paint.
  const enclosing = entry.element.parentElement?.closest<HTMLElement>(MORPH_SELECTOR) ?? null;
  let carrying: MorphFlight | null = null;
  if (enclosing) {
    if (!deferred) {
      queueMicrotask(() => evaluate(scope, store, entry, true, forcedStatus));
      return;
    }
    carrying = [...scope.flights.values()].find((flight) => flight.element === enclosing) ?? null;
  }

  // A nested morph asks nothing of the screen: its container is already
  // carrying it, and the container's flight is the clock it grows on. Looking
  // for a screen ancestor would find none anyway — the container took its
  // subtree out of the screen tree when it was staged.
  const screen = carrying ? null : closestScreen(entry.element);
  // Only the ARRIVING side drives a flight. Both elements are registered at
  // once mid-navigation, and letting either start one would run the pairing
  // twice, in two directions.
  if (!carrying && (!screen || !isArriving(screen, status))) {
    return;
  }

  // AFTER the arriving gate, deliberately: only the side that would actually
  // start a flight may consume the mark. Consuming it on the dismissing side —
  // which reaches this function first and always declines — would spend it a
  // moment before the arriving side asks, and the trip would repeat anyway.
  if (scope.delivered.delete(entry.layoutId)) {
    // A gesture already carried this element to the very place this flight
    // would take it, and landed it a frame or two ago. Flying it again would
    // put it back where it started and repeat the whole trip.
    return;
  }

  const snapshot = scope.snapshots.get(entry.layoutId);
  const gesture = forcedStatus !== undefined;
  const captured =
    snapshot &&
    snapshot.element !== entry.element &&
    isFlightPartner(snapshot.element, status, gesture)
      ? snapshot
      : measurePartnerNow(scope, entry, status, gesture);
  if (!captured) {
    return;
  }

  startFlight(scope, entry, captured, status, screen, store, carrying);
};

// Freeze every registered element's pose at the instant a navigation starts.
//
// This is the one moment the source is guaranteed to be where the user last saw
// it: the store has flipped, but nothing has re-rendered, so the screens still
// wear their resting poses. Waiting until the arriving element mounts would be
// too late — by then its partner is already dressed for the flight.
const capture = (scope: MorphScope): void => {
  // Snapshots outlive the flight that took them, which is what lets an
  // interrupted navigation continue from where the eye last had the element.
  // They must not outlive the ELEMENT: a stack walked twice would otherwise
  // measure its second walk against rects taken on screens that are gone.
  for (const [layoutId, held] of scope.snapshots) {
    if (!held.element.isConnected) scope.snapshots.delete(layoutId);
  }
  for (const entry of scope.entries.values()) {
    if (!entry.element.isConnected) continue;
    const existing = scope.snapshots.get(entry.layoutId);
    // Whatever the direction, the side being LEFT is the top screen, and the
    // top screen is the active one in the state the DOM is still showing (the
    // flip has not been rendered yet). So "prefer active" reads the same for a
    // push and a pop, unlike the arrival, which does not.
    const screen = closestScreen(entry.element);
    if (existing && screen && screen.getAttribute(ACTIVE_ATTR) !== "true") continue;
    scope.snapshots.set(entry.layoutId, {
      snapshot: captureMorphSnapshot(entry.element),
      element: entry.element
    });
  }
};

/**
 * Stage every registered pair as a flight the CALLER drives, and hand back the
 * elements holding it.
 *
 * A programmatic navigation stages its flights when the status flips and lets
 * the compiled hold clock run them. A DRAG has neither: the navigation does not
 * exist yet (it is committed on release, if at all) and there is no hold to
 * mirror. So this takes the same snapshot the status flip would take, stages
 * the same flights under an explicit direction, and leaves them PAUSED at zero
 * for the gesture to move by hand.
 *
 * Exported for `morphSwipe`, which owns the scrubbing; nothing else should
 * stage a flight the runtime does not clock.
 */
export const stageHeldFlights = (
  store: NavigateStoreApi,
  status: NavigateStatus
): MorphFlight[] => {
  const scope = ensureScope(store);
  capture(scope);
  for (const entry of [...scope.entries.values()]) {
    if (!entry.element.isConnected) continue;
    evaluate(scope, store, entry, false, status);
  }
  return [...scope.flights.values()];
};

/**
 * Forget any delivery the navigation never came to collect. A NEW gesture
 * supersedes the last one; only the gesture's own entry point may do this,
 * because the navigation reaches the scope through `stageHeldFlights` too and
 * clearing there would erase the mark a moment before reading it.
 */

/**
 * Record that a gesture's release has DELIVERED whatever it is carrying — it
 * plays those flights out to the arrival itself, so the navigation it commits
 * must not stage them again. Whatever is in the air at the release is exactly
 * what the gesture delivers. See `MorphScope.delivered`.
 */
export const clearGestureDeliveries = (store: NavigateStoreApi): void => {
  ensureScope(store).delivered.clear();
};

export const markGestureDelivered = (store: NavigateStoreApi): void => {
  const scope = ensureScope(store);
  for (const layoutId of scope.flights.keys()) scope.delivered.add(layoutId);
};

/** The flights a scope currently holds — the nested ones included. */
export const heldFlights = (store: NavigateStoreApi): MorphFlight[] => [
  ...ensureScope(store).flights.values()
];

export type { MorphFlight };

const ensureScope = (store: NavigateStoreApi): MorphScope => {
  const existing = scopes.get(store);
  if (existing) return existing;

  const scope: MorphScope = {
    entries: new Map(),
    residue: new Map(),
    snapshots: new Map(),
    flights: new Map(),
    delivered: new Set(),
    /* v8 ignore next -- replaced on the line below; it exists so the field is
       never undefined between construction and subscription. */
    unsubscribe: () => {}
  };
  scope.unsubscribe = store.subscribe((state, previous) => {
    if (state.status === previous.status) return;
    if (!isTransitional(state.status)) return;
    // Order matters: the snapshot has to be taken while a flight already in the
    // air is still in the air, so an interrupted navigation continues from
    // where the eye last had the element rather than from where it would have
    // landed.
    capture(scope);
    for (const flight of [...scope.flights.values()]) flight.finish();
  });
  scopes.set(store, scope);
  return scope;
};

/**
 * Register one element as a morph, and return the disposer.
 *
 * Call it before the paint of the frame the element mounts in, and again
 * whenever its screen's status changes — re-registering is cheap and is what
 * lets a screen that was never frozen still take its side of a pop.
 */
export default function attachMorph(element: HTMLElement, options: AttachMorphOptions): () => void {
  const { layoutId, navigateStore } = options;
  const name = options.name ?? DEFAULT_MORPH_TRANSITION_NAME;
  const scope = ensureScope(navigateStore);
  const rest = element.getBoundingClientRect();
  const entry: MorphEntry = {
    element,
    layoutId: String(layoutId),
    name,
    restSize: rest.width > 0 && rest.height > 0 ? { width: rest.width, height: rest.height } : null
  };

  scope.entries.set(element, entry);
  if (!element.hasAttribute(MORPH_ATTR)) element.setAttribute(MORPH_ATTR, "");
  element.setAttribute(MORPH_NAME_ATTR, String(name));

  evaluate(scope, navigateStore, entry);

  // Deliberately narrow: it drops the registration and NOTHING else. A binding
  // re-registers on every status change (that is the contract), and React runs
  // the previous effect's cleanup before the next one's setup — so tearing a
  // flight down here would abort every morph at the moment its own screen
  // changed status. A flight ends when its travel ends, or at the backstop.
  return () => {
    if (scope.entries.get(element) === entry) scope.entries.delete(element);
  };
}

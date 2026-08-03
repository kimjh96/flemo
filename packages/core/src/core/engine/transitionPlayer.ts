import { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";

import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { resolveEasing, type EasingFunction } from "@transition/cubicBezier";
import type { MotionTarget, VariantMotion } from "@transition/variantMotion";

import driverPolicy, { detectBlinkEngine } from "@core/engine/driverPolicy";
import { perceptualCutMs } from "@core/engine/perceptualSpan";

// ─────────────────────────────────────────────────────────────────────────────
// The rAF transition player: drives transition MOTION by writing inline
// styles every frame from a single shared clock, instead of compiled CSS
// animations.
//
// Why: compositor-driven animations (CSS keyframes and WAAPI alike) miss
// presentation deadlines on raster-heavy layers in Chromium — an
// eye-verified, single-variable A/B (identical visual, identical curve;
// JS-driven smooth, compositor-driven janky), invisible to every JS-side
// metric. Main-thread driving trades that unfixable failure mode for one we
// can both measure (our own frame gaps) and shrink (anim-hold/park/decode
// already move the heavy work out of the transition window).
//
// All participants of one navigation (entering screen, exiting screen, dim
// decorator, riding bars) join ONE player keyed by the navigation task id and
// step off the same clock and the same timestamp — layer harmony by
// construction. Per-frame x/y values snap to device pixels, which the
// compositor never allowed: motion stays even (a smoothly advancing value,
// deterministically snapped) while the leading edge stays crisp.
//
// Coverage is universal, in two tiers. Motion the numeric player can provably
// interpolate (see isPlayerDrivable) is written as inline styles with
// velocity-gated pixel snapping. EVERYTHING ELSE — clip-path morphs across
// templates, calc() expressions, mixed units, one-sided properties, any value
// form a custom transition can declare — is driven by a SCRUBBED Web
// Animation: element.animate() created paused, its currentTime written every
// frame from the same shared clock. The browser performs the interpolation
// with exact CSS semantics (no approximation, discrete pairs flip at 50%
// exactly like the compiled path would), while the progression clock stays on
// the main thread — the same immunity to compositor-clocked jank as the
// numeric tier. The compiled CSS animation path remains only where the player
// must not or cannot run: replay chains, policy-demoted devices, and
// environments without WAAPI. The library decides per variant; consumers
// never do.
// ─────────────────────────────────────────────────────────────────────────────

const TRANSFORM_ORDER = [
  "x",
  "y",
  "z",
  "scale",
  "scaleX",
  "scaleY",
  "rotate",
  "rotateX",
  "rotateY",
  "rotateZ"
] as const;

type TransformProp = (typeof TRANSFORM_ORDER)[number];

const TRANSFORM_PROPS = new Set<string>(TRANSFORM_ORDER);

const IDENTITY: Record<TransformProp, number> = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 0,
  rotateX: 0,
  rotateY: 0,
  rotateZ: 0
};

interface ParsedLength {
  value: number;
  unit: "px" | "%" | "";
}

// Parse one endpoint of a transform channel. Returns null for anything the
// player can't interpolate numerically.
const parseTransformValue = (prop: TransformProp, raw: unknown): ParsedLength | null => {
  if (typeof raw === "number") {
    return { value: raw, unit: prop === "x" || prop === "y" || prop === "z" ? "px" : "" };
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const match = /^(-?\d*\.?\d+)(px|%|deg)?$/.exec(trimmed);
  if (!match) return null;
  const value = parseFloat(match[1]!);
  const unit = match[2] ?? "";
  if (prop === "rotate" || prop === "rotateX" || prop === "rotateY" || prop === "rotateZ") {
    // Degrees only (or unitless zero).
    if (unit !== "deg" && !(unit === "" && value === 0)) return null;
    return { value, unit: "" };
  }
  if (prop === "scale" || prop === "scaleX" || prop === "scaleY") {
    if (unit !== "") return null;
    return { value, unit: "" };
  }
  if (unit === "deg") return null;
  return { value, unit: unit === "" && value === 0 ? "px" : (unit as "px" | "%") };
};

const numberTokens = /-?\d*\.?\d+/g;

// Template interpolation for string CSS values ("blur(8px)" → "blur(0px)"):
// both endpoints must share the exact non-numeric skeleton; the numbers
// interpolate positionally. Returns null when the skeletons differ.
const createStringMixer = (from: string, to: string): ((t: number) => string) | null => {
  const fromNumbers = from.match(numberTokens) ?? [];
  const toNumbers = to.match(numberTokens) ?? [];
  if (fromNumbers.length !== toNumbers.length) return null;
  if (from.replace(numberTokens, " ") !== to.replace(numberTokens, " ")) return null;
  const fromValues = fromNumbers.map(Number);
  const toValues = toNumbers.map(Number);
  return (t: number) => {
    let index = 0;
    return from.replace(numberTokens, () => {
      const i = index++;
      const value = fromValues[i]! + (toValues[i]! - fromValues[i]!) * t;
      return `${Math.round(value * 1000) / 1000}`;
    });
  };
};

const camelToKebab = (prop: string) => prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

interface TransformChannel {
  prop: TransformProp;
  from: ParsedLength;
  to: ParsedLength;
  // px-per-percent factor captured at join time; 0 when % never occurs.
  percentBase: number;
}

interface StringChannel {
  property: string; // kebab-case
  mix: (t: number) => string;
}

interface ParsedMotion {
  transforms: TransformChannel[];
  opacity: { from: number; to: number } | null;
  strings: StringChannel[];
  // from === to: written once at join.
  constants: { property: string; value: string }[];
}

const targetProps = (target: MotionTarget): string[] =>
  isPlainObject(target) ? Object.keys(target) : [];

const readRaw = (target: MotionTarget, prop: string): unknown =>
  isPlainObject(target) ? (target as Record<string, unknown>)[prop] : undefined;

// Whether the NUMERIC tier can faithfully reproduce this variant's motion.
// Any failure here falls through to the scrubbed-WAAPI tier (browser-exact
// interpolation on the shared clock) — never a broken approximation, and
// only without WAAPI does the compiled CSS animation stay in charge.
export const isPlayerDrivable = (motion: VariantMotion): boolean =>
  parseMotion(motion, null) !== null;

// Parse a motion into channels. `element` supplies the percent base
// (offsetWidth/offsetHeight — layout size, transform-independent); pass null
// for a drivability probe.
// Transform composition is NOT commutative: `rotate(90deg) translate(...)`
// lands somewhere else than `translate(...) rotate(90deg)`. The numeric tier
// recomposes channels in TRANSFORM_ORDER (x/y/z merged into one translate3d,
// then scales, then rotates), which is faithful ONLY when the authored key
// order already follows that shape. x/y/z may appear in any order among
// themselves (they merge into a single function) and the scales commute with
// each other, but a translation authored AFTER a rotate/scale — or rotates
// authored out of canonical axis order — would be silently reordered. Those
// motions fall through to the scrub-WAAPI tier, where the browser composes
// the authored list exactly.
const CLASS_OF: Record<TransformProp, number> = {
  x: 0,
  y: 0,
  z: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotate: 2,
  rotateX: 2,
  rotateY: 2,
  rotateZ: 2
};
const authoredOrderIsCanonical = (props: Iterable<string>): boolean => {
  let maxClass = 0;
  let lastRotateIndex = -1;
  for (const prop of props) {
    if (!TRANSFORM_PROPS.has(prop)) continue;
    const cls = CLASS_OF[prop as TransformProp];
    if (cls < maxClass) return false; // a translate/scale after a later class
    maxClass = cls;
    if (cls === 2) {
      const index = TRANSFORM_ORDER.indexOf(prop as TransformProp);
      if (index < lastRotateIndex) return false; // rotates out of axis order
      lastRotateIndex = index;
    }
  }
  return true;
};

// The two endpoints must also be identity-padding COMPATIBLE: the compiler
// preserves each endpoint's own authored function list, and CSS interpolates
// mismatched lists per-function only when one is a prefix of the other
// (identity-padded); anything else falls back to matrix interpolation — a
// path the numeric recomposition cannot reproduce. Collapse x/y/z into one
// translate token (they merge into a single translate3d) and require the
// shorter endpoint's token sequence to be a prefix of the longer's.
const endpointFunctionTokens = (props: Iterable<string>): string[] => {
  const tokens: string[] = [];
  for (const prop of props) {
    if (!TRANSFORM_PROPS.has(prop)) continue;
    const token = CLASS_OF[prop as TransformProp] === 0 ? "T" : prop;
    if (token === "T" && tokens[tokens.length - 1] === "T") continue;
    tokens.push(token);
  }
  return tokens;
};
const endpointsArePaddingCompatible = (from: Iterable<string>, to: Iterable<string>): boolean => {
  const a = endpointFunctionTokens(from);
  const b = endpointFunctionTokens(to);
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.every((token, index) => longer[index] === token);
};

const parseMotion = (motion: VariantMotion, element: HTMLElement | null): ParsedMotion | null => {
  const fromProps = targetProps(motion.from);
  const toProps = targetProps(motion.to);
  // EACH endpoint's authored order must be canonical (a merged set masks a
  // to-side authored rotate-before-translate), and the endpoints must be
  // identity-padding compatible with each other.
  if (!authoredOrderIsCanonical(fromProps) || !authoredOrderIsCanonical(toProps)) return null;
  if (!endpointsArePaddingCompatible(fromProps, toProps)) return null;
  const props = new Set([...fromProps, ...toProps]);
  const transforms: TransformChannel[] = [];
  let opacity: ParsedMotion["opacity"] = null;
  const strings: StringChannel[] = [];
  const constants: ParsedMotion["constants"] = [];

  for (const prop of props) {
    const fromRaw = readRaw(motion.from, prop);
    const toRaw = readRaw(motion.to, prop);

    if (TRANSFORM_PROPS.has(prop)) {
      const transformProp = prop as TransformProp;
      const identity: ParsedLength = {
        value: IDENTITY[transformProp],
        unit: transformProp === "x" || transformProp === "y" || transformProp === "z" ? "px" : ""
      };
      const from = fromRaw === undefined ? identity : parseTransformValue(transformProp, fromRaw);
      const to = toRaw === undefined ? identity : parseTransformValue(transformProp, toRaw);
      if (!from || !to) return null;
      // Mixed units interpolate only when one side is zero (unit-agnostic).
      if (from.unit !== to.unit && from.value !== 0 && to.value !== 0) return null;
      const unit = from.value === 0 && from.unit !== to.unit ? to.unit : from.unit;
      const usesPercent = unit === "%";
      let percentBase = 0;
      if (usesPercent && element) {
        percentBase =
          transformProp === "y" ? element.offsetHeight / 100 : element.offsetWidth / 100;
      }
      transforms.push({
        prop: transformProp,
        from: { value: from.value, unit },
        to: { value: to.value, unit },
        percentBase
      });
      continue;
    }

    if (prop === "opacity") {
      const from = fromRaw === undefined ? 1 : fromRaw;
      const to = toRaw === undefined ? 1 : toRaw;
      if (typeof from !== "number" || typeof to !== "number") return null;
      opacity = { from, to };
      continue;
    }

    // Everything else: constant pass-through or template interpolation.
    if (fromRaw === undefined || toRaw === undefined) return null;
    const fromText = typeof fromRaw === "number" ? `${fromRaw}` : fromRaw;
    const toText = typeof toRaw === "number" ? `${toRaw}` : toRaw;
    if (typeof fromText !== "string" || typeof toText !== "string") return null;
    if (fromText === toText) {
      constants.push({ property: camelToKebab(prop), value: fromText });
      continue;
    }
    const mix = createStringMixer(fromText, toText);
    if (!mix) return null;
    strings.push({ property: camelToKebab(prop), mix });
  }

  return { transforms, opacity, strings, constants };
};

// Below one device pixel of movement per frame, snapping stops hiding inside
// the motion and becomes the motion: the value quantizes into stall-then-jump
// steps (glass-measured on cupertino's decel tail and, for twice as long, on
// the receding screen's 0.35× parallax — the "shivering at the end"). At or
// above one device pixel per frame the ±half-pixel rounding is invisible and
// buys the crisp leading edge.
const SNAP_MIN_DEVICE_PX_PER_FRAME = 1;

// Per-track memory of the previous frame's RAW x/y so the snap gate can
// measure per-frame velocity.
export interface SnapMemory {
  x: number | null;
  y: number | null;
}

// Compose the per-frame transform string. x/y merge into one translate3d.
// Fast motion snaps to device pixels (a smoothly advancing value snapped
// deterministically keeps the leading edge crisp — the compositor's own
// erratic-under-load snapping was the source of both judder (2D path) and
// edge shimmer (3D path)); sub-pixel-per-frame motion writes the raw value so
// the 3D path's texture filtering glides it instead of stepping it.
// Session-scoped diagnostic override for the velocity-gated snap below:
// "always" snaps every frame, "off" always writes raw sub-pixel values.
// An on-device A/B instrument (the gate itself stays the shipped default);
// read once per page load.
// Session-scoped diagnostic for the VALUE-APPLICATION path: "scrub" forces
// the scrub-WAAPI driver for every track (see the join below); read once per
// page load.
let applyOverrideCache: "scrub" | null | undefined;
const snapshotApplyOverride = (): "scrub" | null => {
  if (applyOverrideCache !== undefined) return applyOverrideCache;
  try {
    const value =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flemo:apply") : null;
    applyOverrideCache = value === "scrub" ? value : null;
  } catch {
    applyOverrideCache = null;
  }
  return applyOverrideCache;
};

// Test-only: the session override caches are read once per page load; tests
// reset them to exercise each override path in one module instance.
export const resetSessionOverrideCachesForTests = () => {
  applyOverrideCache = undefined;
  snapOverrideCache = undefined;
  handoffOverrideCache = undefined;
};

// Session-scoped OPT-IN for the anchored-opening HANDOFF below: "on" enables
// it. Default OFF everywhere — the 2026-08 iPhone falsification series ended
// with mid-flight-born animations (however unremarkable their timing)
// intermittently desyncing WebKit's accelerated re-sync at a suspense
// reveal's commit, so no production flight may hand its remainder to one.
// The machinery is retained as a measured instrument (and as the record of
// the series — see the handoff header).
let handoffOverrideCache: "on" | null | undefined;
const handoffOverride = (): "on" | null => {
  if (handoffOverrideCache !== undefined) return handoffOverrideCache;
  try {
    const value =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flemo:handoff") : null;
    handoffOverrideCache = value === "on" ? value : null;
  } catch {
    handoffOverrideCache = null;
  }
  return handoffOverrideCache;
};

let snapOverrideCache: "always" | "off" | null | undefined;
const snapOverride = (): "always" | "off" | null => {
  if (snapOverrideCache !== undefined) return snapOverrideCache;
  try {
    const value =
      typeof sessionStorage !== "undefined" ? sessionStorage.getItem("flemo:snap") : null;
    snapOverrideCache = value === "always" || value === "off" ? value : null;
  } catch {
    snapOverrideCache = null;
  }
  return snapOverrideCache;
};

const composeTransform = (
  channels: TransformChannel[],
  eased: number,
  devicePixelRatio: number,
  snapMemory: SnapMemory
): string => {
  let x = 0;
  let y = 0;
  let hasTranslate = false;
  const parts: string[] = [];
  let allIdentity = true;

  for (const prop of TRANSFORM_ORDER) {
    const channel = channels.find((c) => c.prop === prop);
    if (!channel) continue;
    let value = channel.from.value + (channel.to.value - channel.from.value) * eased;
    if (channel.from.unit === "%") value *= channel.percentBase;

    if (prop === "x" || prop === "y") {
      const last = prop === "x" ? snapMemory.x : snapMemory.y;
      const override = snapOverride();
      const fastEnough =
        override === "always"
          ? true
          : override === "off"
            ? false
            : last === null ||
              Math.abs(value - last) * devicePixelRatio >= SNAP_MIN_DEVICE_PX_PER_FRAME;
      const written =
        fastEnough && devicePixelRatio > 0
          ? Math.round(value * devicePixelRatio) / devicePixelRatio
          : Math.round(value * 1000) / 1000;
      if (prop === "x") {
        snapMemory.x = value;
        x = written;
      } else {
        snapMemory.y = value;
        y = written;
      }
      hasTranslate = true;
      if (written !== 0) allIdentity = false;
      continue;
    }

    const identity = IDENTITY[prop];
    if (value !== identity) allIdentity = false;
    if (prop === "z") parts.push(`translateZ(${value}px)`);
    else if (prop === "scale") parts.push(`scale(${value})`);
    else if (prop === "scaleX") parts.push(`scaleX(${value})`);
    else if (prop === "scaleY") parts.push(`scaleY(${value})`);
    else if (prop === "rotate" || prop === "rotateZ") parts.push(`rotate(${value}deg)`);
    else if (prop === "rotateX") parts.push(`rotateX(${value}deg)`);
    else if (prop === "rotateY") parts.push(`rotateY(${value}deg)`);
  }

  if (!hasTranslate && parts.length === 0) return "";
  if (allIdentity) return "none";
  const translate = hasTranslate ? [`translate3d(${x}px, ${y}px, 0)`] : [];
  return [...translate, ...parts].join(" ");
};

const kebabToCamel = (property: string) =>
  property.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());

// A motion endpoint as a WAAPI keyframe: targetToDecls composes the transform
// shortcuts (x/y/scale/rotate…) into a real `transform` value — including the
// forms the numeric parser rejects, like calc() — and keyframe keys are the
// camelCase property names WAAPI expects.
const motionKeyframe = (target: MotionTarget): Keyframe => {
  const keyframe: Record<string, string> = {};
  for (const decl of targetToDecls(target)) {
    keyframe[kebabToCamel(decl.property)] = decl.value;
  }
  return keyframe as Keyframe;
};

// The universal fallback driver: a PAUSED Web Animation whose currentTime the
// player writes every frame. The browser interpolates with exact CSS
// semantics; the clock is ours. `fill: "both"` pins the from-state in the
// joining commit (the compiled animation is suppressed there) and holds the
// end-state until the detach cancels it and the compiled rest rules take
// back over. Returns null when WAAPI is unavailable or rejects the keyframes
// — the compiled CSS animation then stays in charge, exactly as before.
const createScrubAnimation = (element: HTMLElement, motion: VariantMotion): Animation | null => {
  if (typeof element.animate !== "function") return null;
  try {
    const animation = element.animate([motionKeyframe(motion.from), motionKeyframe(motion.to)], {
      duration: Math.max(0, motion.duration * 1000),
      delay: Math.max(0, motion.delay * 1000),
      easing: easingToCss(motion.ease),
      fill: "both"
    });
    animation.pause();
    animation.currentTime = 0;
    return animation;
  } catch {
    return null;
  }
};

// One nominal 60Hz frame. Used as the amount of progress a re-anchored clock
// is allowed to advance across a stall (one frame, not the whole gap).
const NOMINAL_FRAME_MS = 1000 / 60;

// Stall semantics: how the clock treats one frame gap.
//
// - A gap up to PASS_THROUGH_FRAMES × the display interval is ordinary
//   jitter (a slightly late frame, a single benign vsync slip) and passes
//   through untouched — the clock stays wall-synced.
// - Anything longer is a main-thread block, and the clock advances by
//   EXACTLY ONE display frame: the resume step is then indistinguishable
//   from a normal frame's step — zero velocity discontinuity. This is the
//   final form of the resume policy: the earlier two-frame allowance made a
//   47ms GC-class blip resume with a double step, device-measured as
//   `jump 17%` at peak velocity — the visible half of an otherwise
//   invisible hitch. The frozen frames themselves are physics (nothing can
//   present while main is blocked); the resume jump was ours, and it is
//   gone. The excess re-anchors, so the tail still plays out in full,
//   merely late by the stall.
//
// Both thresholds are measured against the DISPLAY'S OWN cadence: each
// player estimates its interval as the MINIMUM plausible observed gap
// (converges within a few frames; floored so a timer-jitter runt cannot
// fake a 240Hz panel, and seeded at — never above — the 60Hz nominal).
const PASS_THROUGH_FRAMES = 1.6;
const MIN_FRAME_INTERVAL_MS = 1000 / 240;
// A display genuinely pacing at ~30Hz (low-power throttling, constrained
// embedders) delivers EVERY frame at ~33ms. Under a 60Hz-capped estimate
// that reads as a per-frame stall: the clock advances 16.7ms per 33ms of
// wall time, doubling every flight and (on Blink) feeding demotion strikes
// with perfectly healthy frames. Slow gaps are admitted into the estimator
// up to SLOW_CADENCE_MAX_MS, but a slow ESTIMATE additionally requires the
// whole recent window to be slow (SUSTAINED cadence) — a burst of real
// stalls on a fast display must not raise the bar and re-legitimize the
// resume jumps the one-frame policy removed.
const SLOW_CADENCE_MIN_MS = 28;
const SLOW_CADENCE_MAX_MS = 42;

// The last learned cadence, carried across players: each navigation builds a
// fresh player, and on a genuinely slow display re-learning from the 60Hz
// seed would lose a few frames of clock at the top of EVERY flight.
let lastLearnedIntervalMs = NOMINAL_FRAME_MS;

// ── Anchored-opening handoff (non-Blink) ────────────────────────────────────
//
// The player clock solves the flight's OPENING: it anchors t=0 to its own
// first frame and caps steps across stalls, so the entering commit's monster
// frame can never swallow the first fifth of the curve. But per-frame driving
// makes the whole flight ride the main thread, and the flight's TAIL is where
// consumer work lands (suspense resolutions, data-arrival renders) — device-
// measured on iPhone: gap max 42ms, 3 missed frames per 120 during a push,
// each one a visible hitch exactly as the entering screen converges.
//
// On non-Blink engines the browser runs transform/opacity animations OFF the
// main thread (WebKit: in the UI process — a mid-flight commit cannot stall
// them; that immunity is measured fact, it is why the compiled path's tails
// were always smooth on iOS). So each driver is right for one half of the
// flight, and the handoff combines them: the player drives the opening off
// its anchored clock (a scrub-WAAPI track, so the motion is browser-exact
// from the first frame), then hands the remainder to a FRESH Web Animation —
// the original curve's remaining segment BAKED into evenly-spaced keyframes
// over the remaining duration — born running at the handoff frame and never
// touched again. Completion arrives via its finish event instead of the
// player loop.
//
// EVERY ingredient of the remainder animation is deliberately UNREMARKABLE —
// no negative delay, no pause/play, no currentTime writes, no exotic easing —
// because WebKit's accelerated path only stays reliable for animations it can
// treat as ordinary. Three device-falsified designs established that (each
// read fine from JS and failed only on the glass): play() on the scrubbed
// animation lost the accelerated representation outright (the whole remainder
// rode the wall clock through main-thread blocks: freeze, then a leap to the
// end); a compiled CSS animation reborn mid-flight with a negative inline
// animation-delay was smooth per-flight but intermittently froze-then-rushed
// when a mid-flight commit (a suspense reveal) forced the engine to re-sync
// its accelerated animations — the unusual begin time desynced exactly the
// class of animation a naturally-born one survives (the pure compiled path
// historically sailed through those same commits); and a fresh animation with
// a linear() easing brought the convergence stutter back — a non-bezier
// timing function has no Core Animation form, so the remainder ran on the
// main thread again (see buildRemainderKeyframes).
//
// Blink keeps the full player: there the compositor is the driver that
// misses presentation deadlines under raster load (the reason the player
// exists — see the file header), and rAF gaps do not mean presentation gaps.

// How much of the flight the anchored player clock drives before the
// handoff: six nominal frames. Enough for the entry storm to have landed
// (the entering commit blocks the FIRST frame or two) and for the capped
// clock to have absorbed it; early enough that the browser owns the long
// middle and the whole convergence.
const HANDOFF_MS = 6 * NOMINAL_FRAME_MS;

// The remainder animation reproduces the authored curve's tail by BAKING it
// into evenly-spaced keyframes with plain linear easing between them — the
// same shape as a compiled CSS keyframe animation, which is the one form of
// mid-curve motion the accelerated path demonstrably carries on iOS. A
// linear() timing function was device-falsified here: exact in value, but a
// non-standard easing knocks the animation off the accelerated path (Core
// Animation timing is bezier-only), which put the whole remainder back on
// the main thread — the very convergence stutter the handoff exists to
// remove. Baking needs per-sample VALUES, so the handoff requires a
// numerically parseable motion (track.remainderPlan); anything else simply
// stays scrubbed. 41 samples over a ≤700ms remainder is ~one keyframe per
// frame — visually exact for the low-curvature tails this hands off.
const REMAINDER_KEYFRAME_SAMPLES = 41;

const round4 = (value: number) => Math.round(value * 10000) / 10000;

// The transform string at one eased progress — composeTransform's math
// without the per-frame snap machinery (keyframes want raw values; the
// browser interpolates and presents them off the main thread).
const plainTransformAt = (channels: TransformChannel[], eased: number): string => {
  let x = 0;
  let y = 0;
  let hasTranslate = false;
  const parts: string[] = [];
  let allIdentity = true;
  for (const prop of TRANSFORM_ORDER) {
    const channel = channels.find((c) => c.prop === prop);
    if (!channel) continue;
    let value = channel.from.value + (channel.to.value - channel.from.value) * eased;
    if (channel.from.unit === "%") value *= channel.percentBase;
    value = round4(value);
    if (prop === "x" || prop === "y") {
      if (prop === "x") x = value;
      else y = value;
      hasTranslate = true;
      if (value !== 0) allIdentity = false;
      continue;
    }
    if (value !== IDENTITY[prop]) allIdentity = false;
    if (prop === "z") parts.push(`translateZ(${value}px)`);
    else if (prop === "scale") parts.push(`scale(${value})`);
    else if (prop === "scaleX") parts.push(`scaleX(${value})`);
    else if (prop === "scaleY") parts.push(`scaleY(${value})`);
    else if (prop === "rotate" || prop === "rotateZ") parts.push(`rotate(${value}deg)`);
    else if (prop === "rotateX") parts.push(`rotateX(${value}deg)`);
    else if (prop === "rotateY") parts.push(`rotateY(${value}deg)`);
  }
  if (!hasTranslate && parts.length === 0) return "";
  if (allIdentity) return "none";
  const translate = hasTranslate ? [`translate3d(${x}px, ${y}px, 0)`] : [];
  return [...translate, ...parts].join(" ");
};

// Bake the remaining segment of the flight (eased progress f(p)→1 over the
// remaining time) into evenly-spaced keyframes. The first keyframe equals
// the pose the scrub is showing at the handoff frame — same channels, same
// easing function — so the handoff has no visible seam.
const buildRemainderKeyframes = (
  plan: ParsedMotion,
  ease: EasingFunction,
  startProgress: number
): Keyframe[] => {
  const keyframes: Keyframe[] = [];
  for (let i = 0; i < REMAINDER_KEYFRAME_SAMPLES; i += 1) {
    const u = i / (REMAINDER_KEYFRAME_SAMPLES - 1);
    const eased = ease(startProgress + u * (1 - startProgress));
    const keyframe: Record<string, string> = {};
    if (plan.transforms.length > 0) {
      const transform = plainTransformAt(plan.transforms, eased);
      if (transform !== "") keyframe.transform = transform;
    }
    if (plan.opacity) {
      keyframe.opacity = `${round4(plan.opacity.from + (plan.opacity.to - plan.opacity.from) * eased)}`;
    }
    for (const channel of plan.strings) {
      keyframe[kebabToCamel(channel.property)] = channel.mix(eased);
    }
    // Constants hold their value across the whole remainder: first and last
    // keyframes suffice (WAAPI interpolates a property between the keyframes
    // that carry it).
    if (i === 0 || i === REMAINDER_KEYFRAME_SAMPLES - 1) {
      for (const constant of plan.constants) {
        keyframe[kebabToCamel(constant.property)] = constant.value;
      }
    }
    keyframes.push(keyframe as Keyframe);
  }
  return keyframes;
};

export interface PlayerScheduler {
  request: (callback: (time: number) => void) => number;
  cancel: (handle: number) => void;
  devicePixelRatio: () => number;
}

const defaultScheduler = (): PlayerScheduler => ({
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
  devicePixelRatio: () => (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
});

export interface TrackInput {
  element: HTMLElement;
  motion: VariantMotion;
  // The active track's completion resolves the navigation task and stops the
  // player once every track has finished.
  role: "active" | "passive";
  onComplete?: () => void;
}

interface Track extends TrackInput {
  // Numeric tier: per-frame inline writes with velocity-gated px snapping.
  parsed: ParsedMotion | null;
  // Universal tier: a paused Web Animation scrubbed off the shared clock.
  scrub: Animation | null;
  // Anchored-opening handoff (see HANDOFF_MS): whether this scrub track hands
  // its remainder to the browser once the opening is past, and whether it
  // already has (the browser now drives; the finish event completes it).
  handoff: boolean;
  handedOff: boolean;
  // Perceptual tail cut (mirrors the compiled path's perceptualSpan cut):
  // the authored-timeline ms past which THIS track's motion stays inside its
  // imperceptibility band (sub-device-pixel / sub-opacity-step remaining).
  // Null = unanalyzable, which VETOES the navigation's cut (see stepPlayer).
  cutMs: number | null;
  // The parsed numeric motion the remainder keyframes are baked from —
  // retained even though a handoff track scrubs (parsed stays null): baking
  // needs per-sample values, which only the numeric parse can supply.
  remainderPlan: ParsedMotion | null;
  completed: boolean;
  detached: boolean;
  snapMemory: SnapMemory;
}

export interface TransitionPlayerRegistry {
  // Join a participant to the player of one navigation task. Returns a detach
  // function (unmount safety), or null when neither tier can drive it (no
  // WAAPI in this environment) — the caller then leaves the compiled CSS
  // animation in charge.
  join: (taskId: string, input: TrackInput) => (() => void) | null;
  // Drop a whole player (COMPLETED cleanup / interruption).
  dispose: (taskId: string) => void;
  // Frame-gap observer for the driver policy (gaps in ms between our frames).
  onFrameGap?: (gapMs: number) => void;
}

export const createTransitionPlayerRegistry = (
  scheduler: PlayerScheduler = defaultScheduler()
): TransitionPlayerRegistry => {
  interface Player {
    tracks: Track[];
    navComplete: (() => void) | null;
    navCompleted: boolean;
    // The display's measured frame interval (see PASS_THROUGH_FRAMES): the
    // MEDIAN of recent plausible gaps, clamped to [240Hz floor, 60Hz
    // nominal]. A median, not a minimum — one runt gap (a double-fired rAF,
    // timer jitter) must not convince the clock the display is faster than
    // it is and throttle every honest frame after it.
    frameIntervalMs: number;
    recentGaps: number[];
    // The navigation's effective perceptual cut on the shared clock: the MAX
    // of every track's own cut (a longer participant must not be snapped
    // mid-visible-motion), or null when ANY track is unanalyzable (veto,
    // exactly like the compiled path's parts ceiling).
    navCutMs: number | null;
    started: boolean;
    // Whether this player's driver-policy run has been closed. Set on the
    // normal all-done exit, but also when every remaining track has been
    // handed off (no more frames → no more gap evidence) — the finish
    // events that complete those tracks must not close the run twice.
    ended: boolean;
    startTime: number | null;
    lastTime: number | null;
    frameHandle: number | null;
  }

  const players = new Map<string, Player>();

  const registry: TransitionPlayerRegistry = {
    join: (taskId, input) => {
      // Session-scoped diagnostic: `flemo:apply=scrub` routes EVERY track
      // through the scrub-WAAPI path (native interpolation, our clock) so the
      // per-frame style-write path can be A/B'd against it on-device. It
      // deliberately does NOT hand off — it isolates the value-application
      // path, so the whole flight stays scrubbed.
      const forceScrub = snapshotApplyOverride() === "scrub";
      // Anchored-opening handoff (see HANDOFF_MS) — diagnostic OPT-IN only
      // (see handoffOverride): the scrub tier is then PREFERRED for
      // numerically drivable motion, because the handoff needs the browser
      // to own the pose from the first frame (the scrub pins it
      // browser-exactly) and the numeric parse to bake the remainder
      // keyframes from. No WAAPI → the numeric tier still drives; no numeric
      // parse → the scrub drives the whole flight (nothing to bake from).
      const wantsHandoff = !forceScrub && !detectBlinkEngine() && handoffOverride() === "on";
      const numeric = forceScrub ? null : parseMotion(input.motion, input.element);
      const scrub =
        !numeric || wantsHandoff ? createScrubAnimation(input.element, input.motion) : null;
      const parsed = scrub ? null : numeric;
      if (!parsed && !scrub) return null;

      let player = players.get(taskId);
      if (!player) {
        player = {
          tracks: [],
          frameIntervalMs: lastLearnedIntervalMs,
          recentGaps: [],
          navCutMs: null,
          // The navigation-complete callback (the active join's onComplete),
          // fired ONCE when EVERY track has finished on the player's own
          // clock. Firing at the ACTIVE track's end + a wall-clock extra was
          // stall-unsafe: the player re-anchors its logical time across
          // frame gaps, so a stall after the active landed pushed the
          // remaining tracks' completion PAST any wall timer and the flip
          // cut them early — exactly the starvation case the clock defends.
          navComplete: null,
          navCompleted: false,
          started: false,
          ended: false,
          startTime: null,
          lastTime: null,
          frameHandle: null
        };
        players.set(taskId, player);
      }

      // The tail the eye cannot see: past this point the flight presents
      // nothing but sub-pixel churn — and for the rAF player that dead span
      // is ALSO its most starvation-exposed window (main-thread frame gaps
      // read as tremor exactly where motion is slowest). The compiled path
      // has cut it for months (perceptualSpan); the player now cuts its own.
      const cut = perceptualCutMs(input.motion, input.element, scheduler.devicePixelRatio() || 1);

      const track: Track = {
        ...input,
        // The active join's onComplete is the NAVIGATION's completion, not
        // the track's — it moves to the player and fires when every track
        // is done (see navComplete above).
        onComplete: undefined,
        parsed,
        scrub,
        cutMs: cut,
        handoff: wantsHandoff && scrub !== null && numeric !== null,
        handedOff: false,
        remainderPlan: wantsHandoff && scrub !== null ? numeric : null,
        completed: false,
        detached: false,
        snapMemory: { x: null, y: null }
      };
      player.tracks.push(track);
      player.navCutMs = player.tracks.some((t) => t.cutMs === null)
        ? null
        : Math.max(...player.tracks.map((t) => t.cutMs!));

      // Pin the first frame synchronously in the same commit that joined the
      // track: the compiled animation is suppressed here, so without this
      // write the element would show its REST styles for one frame. Every
      // inline write is leased under THIS track's own writer token — two
      // players (nested Routers' concurrent flights) can both hold a shared
      // bar, and a shared token would let the first to detach restore the
      // element out from under the other's still-running frames. A scrub
      // track pins via the paused animation itself (fill "both" at
      // currentTime 0).
      const trackWriter = Symbol("flemo-player-track");
      trackInlineWrite(track.element, "animation", trackWriter);
      track.element.style.animation = "none";
      if (parsed) {
        if (parsed.transforms.length > 0) trackInlineWrite(track.element, "transform", trackWriter);
        if (parsed.opacity) trackInlineWrite(track.element, "opacity", trackWriter);
        for (const channel of parsed.strings)
          trackInlineWrite(track.element, channel.property, trackWriter);
        for (const constant of parsed.constants)
          trackInlineWrite(track.element, constant.property, trackWriter);
        writeTrack(track, 0);
      }

      if (input.role === "active") {
        if (input.onComplete) player.navComplete = input.onComplete;
        if (!player.started) {
          player.started = true;
          driverPolicy.beginRun();
          scheduleFrame(taskId, player);
        }
      }

      return () => {
        track.detached = true;
        // Strip this track's inline writes HERE, not in a status-effect: a
        // covered prev screen FREEZES in the same commit that completes the
        // transition, so its COMPLETED effect never runs — but React still
        // runs this cleanup on the way into the freeze. Idempotent with the
        // engine's COMPLETED cleanup for unfrozen screens. A scrub's
        // fill-"both" end-state outranks the compiled rest rules (animation
        // origin), so it must be cancelled here for the handoff. The clear is
        // scoped to THIS track's writer: if another track (a nested Router's
        // concurrent flight) still drives the same element, its stake keeps
        // the inline values alive and only the LAST detach restores them.
        track.scrub?.cancel();
        clearInlineAnimation(track.element, undefined, trackWriter);
        const current = players.get(taskId);
        if (!current) return;
        current.tracks = current.tracks.filter((t) => t !== track);
        if (current.tracks.length === 0) {
          if (current.frameHandle !== null) scheduler.cancel(current.frameHandle);
          players.delete(taskId);
        }
      };
    },
    dispose: (taskId) => {
      const player = players.get(taskId);
      if (!player) return;
      if (player.frameHandle !== null) scheduler.cancel(player.frameHandle);
      for (const track of player.tracks) track.scrub?.cancel();
      players.delete(taskId);
    }
  };

  const easingOf = new WeakMap<Track, EasingFunction>();
  const trackEasing = (track: Track): EasingFunction => {
    let easing = easingOf.get(track);
    if (!easing) {
      easing = resolveEasing(track.motion.ease);
      easingOf.set(track, easing);
    }
    return easing;
  };

  function writeTrack(track: Track, easedProgress: number) {
    const { element, parsed } = track;
    if (!parsed || !element.isConnected) return;

    if (parsed.transforms.length > 0) {
      const transform = composeTransform(
        parsed.transforms,
        easedProgress,
        scheduler.devicePixelRatio(),
        track.snapMemory
      );
      if (transform !== "") element.style.transform = transform;
    }
    if (parsed.opacity) {
      const { from, to } = parsed.opacity;
      element.style.opacity = `${from + (to - from) * easedProgress}`;
    }
    for (const channel of parsed.strings) {
      element.style.setProperty(channel.property, channel.mix(easedProgress));
    }
    if (easedProgress === 0) {
      for (const constant of parsed.constants) {
        element.style.setProperty(constant.property, constant.value);
      }
    }
  }

  function scheduleFrame(taskId: string, player: Player) {
    player.frameHandle = scheduler.request((time) => {
      player.frameHandle = null;
      stepPlayer(taskId, player, time);
    });
  }

  function endPolicyRun(player: Player) {
    if (player.ended) return;
    player.ended = true;
    driverPolicy.endRun(player.frameIntervalMs);
  }

  // Hand a track's remainder to a FRESH Web Animation: the authored curve's
  // remaining segment baked into plain-linear keyframes over the remaining
  // duration (see buildRemainderKeyframes for why keyframes and not a
  // linear() easing). Born running at this frame and never touched again —
  // no negative delay, no pause/play, no currentTime writes, no exotic
  // easing — every ingredient one the accelerated path demonstrably carries
  // (see the handoff header for the device-falsified designs this replaces).
  // The scrub is cancelled in the same task, and the remainder's first
  // keyframe equals the pose the scrub is showing (same channels, same
  // easing function), so both style states land in ONE rendering update
  // with no visible seam. The compiled CSS animation stays suppressed for the whole
  // flight, exactly as on the plain player path — so the player (via the
  // finish event here) remains the single live resolver, and the engine's
  // `animationend` resolver stays dormant ("never a double" is a hard engine
  // invariant: a duplicate resolution's deferred chain lands on the NEXT
  // queued task — measured as a fast back's pop completing at ~90ms with no
  // motion). Returns false when the environment refuses — the track then
  // stays scrubbed for its whole flight, the pre-handoff behavior.
  function tryHandOff(taskId: string, player: Player, track: Track, currentTimeMs: number) {
    const el = track.element;
    const delayMs = Math.max(0, track.motion.delay * 1000);
    const durationMs = Math.max(0, track.motion.duration * 1000);
    const remainingDelayMs = Math.max(0, delayMs - currentTimeMs);
    const activeElapsedMs = Math.max(0, currentTimeMs - delayMs);
    const remainderMs = durationMs - activeElapsedMs;
    if (remainderMs <= 0) {
      track.handoff = false;
      return false;
    }
    const plan = track.remainderPlan;
    if (!plan) {
      track.handoff = false;
      return false;
    }
    const ease = trackEasing(track);
    const startProgress = durationMs > 0 ? activeElapsedMs / durationMs : 0;
    if (!(1 - ease(startProgress) > 1e-3)) {
      // The remaining eased span is imperceptible: let the scrub finish.
      track.handoff = false;
      return false;
    }
    let remainder: Animation;
    try {
      remainder = el.animate(buildRemainderKeyframes(plan, ease, startProgress), {
        duration: remainderMs,
        delay: remainingDelayMs,
        easing: "linear",
        fill: "both"
      });
    } catch {
      track.handoff = false;
      return false;
    }
    track.scrub!.cancel();
    // The remainder takes over the scrub's slot so every existing teardown
    // (detach, dispose) cancels the LIVE animation and its fill.
    track.scrub = remainder;
    track.handedOff = true;
    remainder.onfinish = () => {
      if (track.completed || track.detached) return;
      track.completed = true;
      track.onComplete?.();
      if (players.get(taskId) !== player) return;
      if (player.tracks.every((t) => t.completed || t.detached)) {
        if (!player.navCompleted) {
          player.navCompleted = true;
          player.navComplete?.();
        }
        endPolicyRun(player);
        players.delete(taskId);
      }
    };
    // On-device diagnostics: handoff moments, mirrored like the frame gaps.
    if (typeof window !== "undefined") {
      const log = ((window as { __flemoHandoffs?: number[] }).__flemoHandoffs ??= []);
      log.push(Math.round(currentTimeMs));
      if (log.length > 100) log.splice(0, log.length - 100);
    }
    return true;
  }

  function stepPlayer(taskId: string, player: Player, time: number) {
    // This frame's anchor. `??` (not `||`) so a legitimate t0 of 0 stays 0.
    let startTime = player.startTime ?? time;

    if (player.lastTime !== null) {
      const gap = time - player.lastTime;
      // Report the RAW gap — the true time since our last frame — to the driver
      // policy and the diagnostic hook BEFORE any re-anchor. The policy demotes
      // a device off its OWN measured stalls (driverPolicy.ts); re-anchoring
      // must never launder that evidence. Re-anchoring shifts startTime, never
      // lastTime, so the reported gap is identical either way — reporting first
      // makes that guarantee structural, not incidental.
      driverPolicy.reportGap(gap);
      registry.onFrameGap?.(gap);
      if (gap >= MIN_FRAME_INTERVAL_MS && gap <= SLOW_CADENCE_MAX_MS) {
        player.recentGaps.push(gap);
        if (player.recentGaps.length > 7) player.recentGaps.shift();
        const sorted = [...player.recentGaps].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)]!;
        const sustainedSlow =
          player.recentGaps.length >= 4 &&
          player.recentGaps.every((sample) => sample >= SLOW_CADENCE_MIN_MS);
        player.frameIntervalMs = Math.min(
          sustainedSlow ? SLOW_CADENCE_MAX_MS : NOMINAL_FRAME_MS,
          Math.max(MIN_FRAME_INTERVAL_MS, median)
        );
        lastLearnedIntervalMs = player.frameIntervalMs;
      }
      // Re-anchor across a main-thread stall (see PASS_THROUGH_FRAMES):
      // beyond ordinary jitter the clock advances exactly ONE display frame,
      // so the resume step matches a normal frame's step — no velocity
      // discontinuity. Scrub-WAAPI tracks derive currentTime from this same
      // startTime, so they re-anchor with it automatically.
      if (gap > PASS_THROUGH_FRAMES * player.frameIntervalMs) {
        startTime += gap - player.frameIntervalMs;
      }
    }
    player.startTime = startTime;
    player.lastTime = time;

    let allDone = true;
    let needsFrame = false;
    for (const track of player.tracks) {
      if (track.completed || track.detached) continue;
      const durationMs = track.motion.duration * 1000;
      const delayMs = track.motion.delay * 1000;
      const elapsed = time - startTime;
      // Perceptual tail cut, on the player's own capped clock (a stall
      // shifts startTime, so the cut shifts with presentation — the wall-
      // clock hazard the compiled path had to disarm for never exists
      // here). Past the navigation's cut every remaining value is inside
      // the imperceptibility band: complete now, and the COMPLETED flip's
      // rest snap is sub-pixel by construction.
      if (player.navCutMs !== null && elapsed >= player.navCutMs) {
        track.completed = true;
        track.onComplete?.();
        continue;
      }

      if (track.scrub) {
        // A handed-off track is the browser's: no writes, no frames — its
        // finish event completes it (tryHandOff).
        if (track.handedOff) {
          allDone = false;
          continue;
        }
        // The browser interpolates; we only advance its clock. Raw (uneased)
        // time — the easing lives in the animation's own timing function.
        const totalMs = delayMs + durationMs;
        const currentTimeMs = Math.min(Math.max(0, elapsed), totalMs);
        if (
          track.handoff &&
          elapsed >= HANDOFF_MS &&
          elapsed < totalMs &&
          tryHandOff(taskId, player, track, currentTimeMs)
        ) {
          allDone = false;
          continue;
        }
        track.scrub.currentTime = currentTimeMs;
        if (elapsed >= totalMs) {
          track.completed = true;
          track.onComplete?.();
        } else {
          allDone = false;
          needsFrame = true;
        }
        continue;
      }

      const local =
        durationMs <= 0 ? 1 : Math.min(1, Math.max(0, (elapsed - delayMs) / durationMs));
      writeTrack(track, trackEasing(track)(local));
      if (local >= 1) {
        track.completed = true;
        track.onComplete?.();
      } else {
        allDone = false;
        needsFrame = true;
      }
    }

    if (allDone) {
      if (!player.navCompleted) {
        player.navCompleted = true;
        player.navComplete?.();
      }
      endPolicyRun(player);
      players.delete(taskId);
      return;
    }
    if (!needsFrame) {
      // Every remaining track is handed off: the browser presents, finish
      // events complete. Stop the loop — from here a main-thread gap is not
      // a presentation gap, so the run's stall evidence is complete too.
      endPolicyRun(player);
      return;
    }
    scheduleFrame(taskId, player);
  }

  return registry;
};

// The app-wide registry the engine drives; tests build their own with a fake
// scheduler.
const transitionPlayers = createTransitionPlayerRegistry();

export default transitionPlayers;

// Diagnostics: every player frame gap is mirrored to a window hook so a
// harness (or a bug report) can read the player's own clock without a
// custom build. Negligible cost; assigned once at module load.
declare global {
  interface Window {
    __flemoPlayerGaps?: number[];
  }
}
transitionPlayers.onFrameGap = (gapMs) => {
  if (typeof window !== "undefined") {
    const gaps = (window.__flemoPlayerGaps ??= []);
    gaps.push(Math.round(gapMs * 10) / 10);
    if (gaps.length > 600) gaps.splice(0, gaps.length - 600);
  }
};

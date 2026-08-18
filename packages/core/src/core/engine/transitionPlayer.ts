import { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";

import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { resolveEasing, type EasingFunction } from "@transition/cubicBezier";
import settleScrubber from "@transition/settleScrub";
import type { MotionTarget, VariantMotion } from "@transition/variantMotion";

import {
  handoffMs,
  handoffOverride,
  jitterBandMaxDevicePx,
  snapOverride,
  snapshotApplyOverride
} from "@core/engine/diagnosticFlags";
import driverPolicy, { detectBlinkEngine } from "@core/engine/driverPolicy";
import { perceptualCutMs } from "@core/engine/perceptualSpan";
import {
  HIGH_REFRESH_MAX_INTERVAL_MS,
  reportInFlightCadence,
  steadySixtyPlayerEligible
} from "@core/engine/steadySixtyCadence";

// Test seam re-export: the session override caches now live in the flag
// registry, but the suites reach them through this module.
export { resetSessionOverrideCachesForTests } from "@core/engine/diagnosticFlags";

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
// Judged at the 60Hz nominal frame: the gate's intent is a VELOCITY
// threshold (trackable glide vs out-running motion), so the crossing must
// not move with the display's refresh rate. Un-normalized, a 120Hz
// ProMotion panel halves the per-frame travel and pulls the snap→fractional
// character flip from the deep tail up to ~60% of the flight — an
// eye-visible onset of judder on the built-in display that a 60Hz external
// never shows.
const SNAP_MIN_DEVICE_PX_PER_NOMINAL_FRAME = 1;
// One nominal 60Hz frame: the gate's normalization base, and the amount of
// progress a re-anchored clock may advance across a stall (one frame, not
// the whole gap).
const NOMINAL_FRAME_MS = 1000 / 60;

// Per-track memory of the previous frame's RAW x/y so the snap gate can
// measure per-frame velocity.
export interface SnapMemory {
  x: number | null;
  y: number | null;
  // The landing governor's last written value per axis (see composeTransform):
  // non-null once the governor has taken the tail over.
  landingX?: number | null;
  landingY?: number | null;
  // The last PRESENTED value per axis — the landing governor hands over from
  // here so its first step continues what was actually on glass.
  writtenX?: number | null;
  writtenY?: number | null;
  // Set by composeTransform whenever the governor's cap wrote SHORT of the
  // end pose: the caller's completion paths (the perceptual cut) must keep
  // ticking until the presented pose has actually landed.
  pendingLanding?: boolean;
  // Steady-60 desktop pure-glide, decided PER TRACK at join (see
  // glidePreferredForParsed): true only for slow parallax-class tracks in an
  // eligible session. Fast movers keep the gate's snapping and the governor.
  glide?: boolean;
}

// Compose the per-frame transform string. x/y merge into one translate3d.
// Fast motion snaps to device pixels (a smoothly advancing value snapped
// deterministically keeps the leading edge crisp — the compositor's own
// erratic-under-load snapping was the source of both judder (2D path) and
// edge shimmer (3D path)); sub-pixel-per-frame motion writes the raw value so
// the 3D path's texture filtering glides it instead of stepping it.
//
// Session-scoped diagnostic overrides (`flemo:snap`, `flemo:apply`,
// `flemo:handoff`, `flemo:snapband`, `flemo:handoffms`) live in the flag
// registry (diagnosticFlags.ts) — read once per page load and cached there;
// tests reset the caches through resetSessionOverrideCachesForTests.

// The DEFAULT snap policy, per platform — both ends device-judged (2026-08):
// - WebKit at DESKTOP densities (dpr < 3): snap EVERY frame. The felt "지글"
//   on Mac Safari measured as continuous texture resampling through the
//   glide (frame-to-frame texture correlation 0.65-0.85 vs 0.999 at rest,
//   dense 2x text amplifying every fractional phase); the user A/B judged
//   always-snap better there — at 2x a step is half a CSS pixel.
// - WebKit at phone densities (dpr >= 3): the velocity gate. The same A/B on
//   the phone judged the gate best (always-snap read as stepping on the slow
//   parallax; raw glide sizzled) — at 3x the sub-pixel glide wins the tail.
// - Blink (touch AND desktop): the velocity gate. Touch was device-judged on
//   the phone (always-snap read as stepping on the slow parallax). Desktop
//   was BRIEFLY flipped to always-snap when the steady-60 routing landed —
//   inferred from a session note taken against the COMPILED tier's artifacts
//   — and immediately device-refuted on the player itself: the pop
//   parallax's long sub-pixel tail presented as "드르륵" ratcheting (integer
//   holds-and-steps, made salient by this platform's uneven present pacing,
//   the proven out-of-reach layer), while the direct same-display verdict on
//   the player has always been that the fractional glide wins slow tracked
//   motion — the bilinear blur masks both the phases and the present
//   cadence. Fast spans still snap via the gate; the landing governor still
//   owns the sub-pixel tail's close.
// The session override (always/off/gate/hybrid) replaces the default either
// way.
const defaultAlwaysSnap = (devicePixelRatio: number): boolean =>
  !detectBlinkEngine() && devicePixelRatio > 0 && devicePixelRatio < 3;

// STEADY-60 DESKTOP (the only route by which a desktop Blink flight reaches
// this player — see steadySixtyCadence): the snap treatment splits PER
// TRACK, because the two motion classes of one navigation were device-judged
// (4K@60Hz 2x, 2026-08-18) to want OPPOSITE cures:
//
// - SLOW PARALLAX tracks (a pop's returning screen, a push's exiting
//   screen — ~30% travel, long sub-device-pixel tails): every
//   integer-stepping variant — always-snap, the gate's 1-device-px minimum
//   steps, and the landing governor's 1px/frame staircase over the last 12
//   device px (snap-mode-independent, so even `snap=off` stepped the tail)
//   — presents as deterministic "드르륵" ratcheting, because this
//   platform's uneven present pacing (the proven out-of-reach layer) turns
//   a metronomic 1-device-px cadence into visible 0-2px stutters. These
//   tracks GLIDE: raw fractional writes, governor stood down — bilinear
//   filtering masks both the sub-pixel phases and the present cadence, and
//   the flight still ends exactly on the rest pose via the perceptual cut.
//   (Applying the glide to EVERYTHING was tried and immediately refuted:
//   the push's entering screen got visibly worse — see the next class.)
// - FAST FULL-TRAVEL tracks (a push's entering screen, a pop's exiting
//   screen — ~full-viewport travel): unsnapped fractional motion
//   resamples the screen's dense content through the whole flight (texture
//   sizzle — the same-day verdict that made always-snap the 8/17 fix), so
//   they KEEP the gate's snapping and the governor's crisp close.
//
// Touch and WebKit keep their device-verified snapping and governor
// unchanged; the flemo:snap session override still replaces everything.
// The slow/fast boundary. cupertino's classes sit far on either side of it:
// the parallax travels 30% (fraction 0.3) while the entering/exiting slide
// travels 100% (fraction 1.0); px-authored motion classifies by absolute
// device travel instead (600 device px ≈ a 300-CSS-px slide at 2x).
const GLIDE_MAX_TRAVEL_FRACTION = 0.6;
const GLIDE_MAX_TRAVEL_DEVICE_PX = 600;
const glidePreferredForParsed = (parsed: ParsedMotion, devicePixelRatio: number): boolean => {
  if (!steadySixtyPlayerEligible()) return false;
  for (const channel of parsed.transforms) {
    if (channel.prop !== "x" && channel.prop !== "y") continue;
    const travel = Math.abs(channel.to.value - channel.from.value);
    if (channel.from.unit === "%") {
      // Percent-authored travel classifies by its fraction of the element
      // box — viewport-size-independent (a pop parallax is 30% at any width).
      if (travel / 100 >= GLIDE_MAX_TRAVEL_FRACTION) return false;
    } else if (travel * Math.max(1, devicePixelRatio) >= GLIDE_MAX_TRAVEL_DEVICE_PX) {
      return false;
    }
  }
  return true;
};

// The landing governor's engagement range (device pixels): once the curve's
// per-frame travel drops below one device pixel INSIDE this range, the
// governor closes the tail at exactly one device pixel per frame — see the
// landing-governor comment in composeTransform. 12 covers the slowest case
// measured (a parallax return's sub-pixel crawl begins ~9 device px out).
const REST_LANDING_MAX_DEVICE_PX = 12;

// The jitter band (device px per ACTUAL frame): below this step size,
// integer snapping modulates the presented velocity by up to ±0.5px/frame —
// 17-50% of the step. Used by the "hybrid" diagnostic (fractional through
// the band, snapped above; width tunable via `flemo:snapband`, see
// diagnosticFlags.ts). On Blink the high-refresh COMPILED routing (see
// createTransitionEngine) removes the player from the displays where this
// modulation was eye-visible; a 2026-08 attempt to present the band at half
// cadence on the player was eye-falsified (no improvement, and it would
// have force-degraded true-120Hz WebKit devices), so the player keeps plain
// per-frame snapping here.

const composeTransform = (
  channels: TransformChannel[],
  eased: number,
  devicePixelRatio: number,
  snapMemory: SnapMemory,
  frameIntervalMs: number = NOMINAL_FRAME_MS
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
      // "hybrid" (diagnostic): fractional through the jitter band — phases
      // sweep at least one device pixel per frame there, so the bilinear
      // blur reads as ordinary motion blur instead of the snapped
      // alternation — and snapped only above it; the governor still owns
      // the sub-pixel tail.
      const stepForGate = last === null ? Infinity : Math.abs(value - last) * devicePixelRatio;
      const glide = override === null && snapMemory.glide === true;
      const fastEnough = glide
        ? false
        : override === "always" || (override === null && defaultAlwaysSnap(devicePixelRatio))
          ? true
          : override === "off"
            ? false
            : override === "hybrid"
              ? stepForGate >= jitterBandMaxDevicePx()
              : last === null ||
                (stepForGate * NOMINAL_FRAME_MS) / Math.max(1, frameIntervalMs) >=
                  SNAP_MIN_DEVICE_PX_PER_NOMINAL_FRAME;
      // The landing governor: a decelerating curve's flat tail spends its
      // last ~100-150ms (a big screen's push) to ~300ms (a parallax return —
      // less travel, so the SAME curve moves even slower in absolute pixels)
      // crawling its final pixels below one device pixel per frame. That
      // span cannot present as motion: it presents as PARKED short of the
      // landing point — frame-diffed as a high-contrast sliver of the
      // covered screen at the sheet's leading edge, or a whole parallax
      // sitting offset — and then the remainder ticks in late (a jump on
      // any all-at-once landing, a COMPLETED-flip tick otherwise). So once
      // the curve can no longer sustain a device pixel per frame inside the
      // engagement range, the player takes the tail over and closes it at
      // EXACTLY one device pixel per frame — the crisp minimum the eye
      // still reads as motion. No park, no jump: the settle finishes
      // monotone, ahead of the authored asymptote, ending exactly on the
      // rest pose. Engagement latches (landingX/landingY); an interrupted
      // flight tears the track down, so no stale latch survives.
      let end = channel.to.value;
      if (channel.from.unit === "%") end *= channel.percentBase;
      const landKey = prop === "x" ? "landingX" : "landingY";
      const priorLanding = snapMemory[landKey];
      const remainingDevice = Math.abs(value - end) * devicePixelRatio;
      const stepDevice = last === null ? Infinity : Math.abs(value - last) * devicePixelRatio;
      // The governor latches only on a SLOW tail (sub-pixel per frame): an
      // overshooting ease crosses the end fast and must keep playing its
      // bounce — its own final approach decelerates into the latch later.
      const engaged =
        !glide &&
        devicePixelRatio > 0 &&
        (priorLanding != null || (stepDevice < 1 && remainingDevice <= REST_LANDING_MAX_DEVICE_PX));
      const writtenKey = prop === "x" ? "writtenX" : "writtenY";
      let written: number;
      if (engaged) {
        // Hand over from the last PRESENTED pose, not the raw curve — a raw
        // restart would jump a held half-cadence frame in one step.
        const fromValue = priorLanding ?? snapMemory[writtenKey] ?? value;
        const unitPx = 1 / devicePixelRatio;
        const next =
          Math.abs(end - fromValue) <= unitPx + 1e-6
            ? end
            : fromValue + Math.sign(end - fromValue) * unitPx;
        written = Math.round(next * 1000) / 1000;
        snapMemory[landKey] = next;
        snapMemory[writtenKey] = null;
        if (next !== end) snapMemory.pendingLanding = true;
      } else if (devicePixelRatio > 0 && remainingDevice < 1) {
        // A FAST arrival inside the last device pixel (a linear ramp, an
        // overshoot crossing): the rest pose IS the nearest grid point —
        // written without latching, so a bounce keeps playing.
        written = Math.round(end * 1000) / 1000;
        snapMemory[writtenKey] = null;
      } else {
        written =
          fastEnough && devicePixelRatio > 0
            ? Math.round(value * devicePixelRatio) / devicePixelRatio
            : Math.round(value * 1000) / 1000;
        snapMemory[writtenKey] = written;
      }
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
// fake an implausibly fast panel, and seeded at — never above — the 60Hz
// nominal). The floor tracks the fastest panels actually shipping: consumer
// esports monitors reach ~540-600Hz (2025), so the old 240Hz floor CLAMPED
// a genuine high-refresh desktop's estimate down to 240Hz — the pacing
// heuristics (jitter thresholds, pixel-snap budgets) then ran calibrated for
// a slower display than the panel really is. Raised to 600Hz. The estimate is
// a MEDIAN (a lone runt gap can't move it), so widening the floor does not
// reopen the jitter-fakes-a-fast-panel hole the floor guards.
const PASS_THROUGH_FRAMES = 1.6;
const MIN_FRAME_INTERVAL_MS = 1000 / 600;
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

// The engine's tier routing needs the display cadence OUTSIDE a live player
// (a routed-compiled flight runs no player to learn from): expose the
// learned interval, and accept refreshed samples from the engine's own
// probe so a window moved between displays re-routes within a flight or two.
export const learnedFrameIntervalMs = (): number => lastLearnedIntervalMs;
export const reportDisplayIntervalMs = (intervalMs: number): void => {
  if (!Number.isFinite(intervalMs)) return;
  if (intervalMs < MIN_FRAME_INTERVAL_MS || intervalMs > SLOW_CADENCE_MAX_MS) return;
  lastLearnedIntervalMs = Math.min(NOMINAL_FRAME_MS, Math.max(MIN_FRAME_INTERVAL_MS, intervalMs));
};

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
// handoff: six nominal frames by default (HANDOFF_MS_DEFAULT, tunable per
// session via `flemo:handoffms` — see handoffMs in diagnosticFlags.ts).
// Enough for the entry storm to have landed (the entering commit blocks the
// FIRST frame or two) and for the capped clock to have absorbed it; early
// enough that the browser owns the long middle and the whole convergence.
// Session-scoped OPT-IN (`flemo:handoff=on`, see handoffOverride in
// diagnosticFlags.ts). Default OFF everywhere — the 2026-08 iPhone
// falsification series ended with mid-flight-born animations (however
// unremarkable their timing) intermittently desyncing WebKit's accelerated
// re-sync at a suspense reveal's commit, so no production flight may hand
// its remainder to one. The machinery is retained as a measured instrument
// (and as the record of the series — see above).

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
  // The navigation status (PUSHING/POPPING/REPLACING) — lets a driver scope
  // itself per flight KIND. The handoff uses it: the tail-desync it can suffer
  // is triggered by a suspense/data commit landing mid-flight, which happens
  // when a fresh screen mounts (PUSH/REPLACE) — never on a POP back to an
  // already-mounted screen. So the handoff is scoped to POPPING.
  status?: string;
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
      const wantsHandoff =
        !forceScrub &&
        !detectBlinkEngine() &&
        handoffOverride() === "on" &&
        // The mid-flight-born remainder desyncs when a fresh screen's suspense/
        // data commit lands mid-flight (see the handoff header) — that only
        // happens on PUSH/REPLACE (a screen mounting). POP returns to an
        // already-mounted screen, so its tail is safe to hand off. Block the
        // two mounting kinds explicitly; an unspecified status (unit tests
        // exercising the machinery) still hands off.
        input.status !== "PUSHING" &&
        input.status !== "REPLACING";
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
        snapMemory: {
          x: null,
          y: null,
          glide: parsed ? glidePreferredForParsed(parsed, scheduler.devicePixelRatio() || 1) : false
        }
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
      // A NAVIGATION owns its participants: force-conclude any running
      // settle (owner-less takeover pins the current pose) before pinning
      // the from frame. Without this, a tap that grazed the swipe edge
      // starts a 300ms cancel settle in the SAME gesture that starts this
      // flight, and the settle's WAAPI outranks the player's inline writes
      // for its whole span — device-captured as the pop gliding backward
      // then teleporting to the player's true position.
      settleScrubber.takeover(track.element);
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

  function writeTrack(track: Track, easedProgress: number, frameIntervalMs?: number) {
    const { element, parsed } = track;
    if (!parsed || !element.isConnected) return;

    if (parsed.transforms.length > 0) {
      const transform = composeTransform(
        parsed.transforms,
        easedProgress,
        scheduler.devicePixelRatio(),
        track.snapMemory,
        frameIntervalMs
      );
      if (transform !== "") element.style.transform = transform;
    }
    if (parsed.opacity) {
      const { from, to } = parsed.opacity;
      // Quantize to the display's alpha grid (1/255): the sub-step tail of a
      // long fade otherwise lands its final imperceptible fraction in the
      // COMPLETED flip's frame — measured on a real-display capture as a
      // whole-window tone step at every landing (the dim decorator's last
      // 0.8% arriving as a discrete rest-frame event). On the grid, the
      // last representable alpha is reached while the motion still moves,
      // and the flip writes nothing new.
      const raw = from + (to - from) * easedProgress;
      element.style.opacity = `${Math.round(raw * 255) / 255}`;
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
    // Anchor to the pose the scrub is actually PRESENTING (its committed
    // currentTime), which lags this frame's clock by the last-set frame. The
    // remainder's one-frame birth-advance then resumes from the presented pose
    // rather than jumping ahead of it. Falls back to the clock if the scrub has
    // no numeric currentTime (jsdom/exotic).
    const presentedMs =
      typeof track.scrub?.currentTime === "number" ? track.scrub.currentTime : currentTimeMs;
    const activeElapsedMs = Math.max(0, presentedMs - delayMs);
    const remainderMs = durationMs - activeElapsedMs;
    if (remainderMs <= 0) {
      track.handoff = false;
      return false;
    }
    // A handoff still requires a numerically parseable motion (a well-behaved
    // transform/opacity curve the accelerated path carries) — anything else
    // stays scrubbed for its whole flight.
    if (!track.remainderPlan) {
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
      // Exact-curve remainder: the SAME two endpoints and bezier easing as the
      // scrub, started mid-curve via a NEGATIVE delay (its currentTime begins
      // at activeElapsedMs). Baking the tail into evenly-spaced keyframes and
      // playing them LINEAR left a small approximation over-step at the seam
      // (device-measured ~8 device px at the handoff frame — the linear chords
      // cut the curve); the real bezier removes it entirely. The easing is a
      // genuine cubic-bezier (a Core Animation timing form), so the remainder
      // stays on the accelerated path. The negative-delay re-sync hazard the
      // handoff header records is a PUSH/REPLACE concern (a fresh screen's
      // mid-flight commit forcing accelerated re-sync); this path is scoped
      // away from those (see wantsHandoff — POP/undefined only).
      remainder = el.animate([motionKeyframe(track.motion.from), motionKeyframe(track.motion.to)], {
        duration: durationMs,
        delay: -activeElapsedMs,
        easing: easingToCss(track.motion.ease),
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
        // The steady-60 verdict listens to the player's own cadence for the
        // HIGH-REFRESH question only — with the window's max gap, so the
        // jam-noise guard can tell a GENUINE high-refresh stream (a window
        // moved onto a 120Hz panel: uniform 8.3ms, re-latches the session
        // compiled) from a catch-up burst (fast median, jam-sized max:
        // ignored). Mid-band medians from this longer, noisier stream are
        // NOT reported — they must not reset the streak the probe windows
        // built. The routing never consults the learned interval on
        // desktop, so this is the only cadence path that can demote a
        // graduated session.
        if (median < HIGH_REFRESH_MAX_INTERVAL_MS) {
          reportInFlightCadence(median, sorted[sorted.length - 1]!);
        }
      }
      // Re-anchor across a main-thread stall (see PASS_THROUGH_FRAMES):
      // beyond ordinary jitter the clock advances exactly ONE display frame,
      // so the resume step matches a normal frame's step — no velocity
      // discontinuity. Scrub-WAAPI tracks derive currentTime from this same
      // startTime, so they re-anchor with it automatically.
      // (2026-08 iPhone note: a jitter-capped clock — never advancing more
      // than one frame per step — plus a post-frame MessageChannel commit
      // probe was ported here from a device-approved synthetic A/B and made
      // the REAL app worse: live pages carry per-frame rendering cost that
      // the probe reads as a blown commit window, so the compensation held
      // frames constantly. Both were reverted; the synthetic win did not
      // transfer. Do not re-attempt without an adaptive per-page baseline.)
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
        // Present the rest pose ON the cut frame. The cut's residue is
        // sub-band by construction, but the snapped presentation can sit one
        // device pixel short of it — and completing without a write parks
        // that hairline (the sheet's leading-edge gap) until the COMPLETED
        // flip's style teardown, measured ~80-120ms later under a busy React
        // commit (real Chrome, 2560-device-px push: rem=1 held for five
        // frames past the authored end). A governor latched mid-close keeps
        // its one-pixel-per-frame rhythm: the track stays live until the
        // presented pose has landed. Scrubbed tracks are the browser's to
        // present.
        if (!track.scrub) {
          track.snapMemory.pendingLanding = false;
          writeTrack(track, 1, player.frameIntervalMs);
          if (track.snapMemory.pendingLanding) {
            allDone = false;
            needsFrame = true;
            continue;
          }
        }
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
        // Hand off from the pose the scrub is CURRENTLY PRESENTING (its last
        // committed currentTime), not this frame's clock: a born-playing
        // remainder advances ~one frame between birth and its first composite
        // (device-measured: remainder observed already at currentTime≈16ms), so
        // baking it from the presented pose lets that one-frame birth-advance
        // land its first paint exactly one frame past the last scrub paint — a
        // seamless continuation instead of a forward jump.
        if (
          track.handoff &&
          elapsed >= handoffMs() &&
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
      if (local >= 1) track.snapMemory.pendingLanding = false;
      writeTrack(track, trackEasing(track)(local), player.frameIntervalMs);
      if (local >= 1 && !track.snapMemory.pendingLanding) {
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

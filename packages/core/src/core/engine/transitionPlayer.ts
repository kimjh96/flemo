import { clearInlineAnimation, trackInlineWrite } from "@transition/animateInline";

import { easingToCss, targetToDecls } from "@transition/compileTransitionStyles";
import { resolveEasing, type EasingFunction } from "@transition/cubicBezier";
import type { MotionTarget, VariantMotion } from "@transition/variantMotion";

import driverPolicy from "@core/engine/driverPolicy";

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
const parseMotion = (motion: VariantMotion, element: HTMLElement | null): ParsedMotion | null => {
  const props = new Set([...targetProps(motion.from), ...targetProps(motion.to)]);
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

// The most the shared clock may advance across ONE frame gap: two nominal
// frames — exactly what a natural double-vsync drop produces, so ordinary
// jitter passes through untouched. Anything longer is a main-thread block (a
// consumer commit, the COMPLETED flip of a neighbouring navigation), and
// stepping motion by the full gap plays the authored curve compressed — a
// 40-100ms block used to slip under the old 100ms re-anchor cliff and read
// as the screen "whooshing" ahead of its easing. Capping the step keeps
// every stall inside the player's delayed-but-complete semantics: motion
// resumes at most two frames past where it stalled, and the tail plays out
// in full (the liveness floor still bounds a pathological stall pile-up).
const MAX_CLOCK_STEP_MS = 2 * NOMINAL_FRAME_MS;

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
    started: boolean;
    startTime: number | null;
    lastTime: number | null;
    frameHandle: number | null;
  }

  const players = new Map<string, Player>();

  const registry: TransitionPlayerRegistry = {
    join: (taskId, input) => {
      // Session-scoped diagnostic: `flemo:apply=scrub` routes EVERY track
      // through the scrub-WAAPI path (native interpolation, our clock) so the
      // per-frame style-write path can be A/B'd against it on-device.
      const forceScrub = snapshotApplyOverride() === "scrub";
      const parsed = forceScrub ? null : parseMotion(input.motion, input.element);
      const scrub = parsed ? null : createScrubAnimation(input.element, input.motion);
      if (!parsed && !scrub) return null;

      let player = players.get(taskId);
      if (!player) {
        player = {
          tracks: [],
          started: false,
          startTime: null,
          lastTime: null,
          frameHandle: null
        };
        players.set(taskId, player);
      }

      const track: Track = {
        ...input,
        parsed,
        scrub,
        completed: false,
        detached: false,
        snapMemory: { x: null, y: null }
      };
      player.tracks.push(track);

      // Pin the first frame synchronously in the same commit that joined the
      // track: the compiled animation is suppressed here, so without this
      // write the element would show its REST styles for one frame. Every
      // inline write is registered with the animateInline tracker so the
      // COMPLETED cleanup (clearInlineAnimation) strips them and the compiled
      // rest rules take back over. A scrub track pins via the paused
      // animation itself (fill "both" at currentTime 0).
      track.element.style.animation = "none";
      trackInlineWrite(track.element, "animation");
      if (parsed) {
        if (parsed.transforms.length > 0) trackInlineWrite(track.element, "transform");
        if (parsed.opacity) trackInlineWrite(track.element, "opacity");
        for (const channel of parsed.strings) trackInlineWrite(track.element, channel.property);
        for (const constant of parsed.constants) trackInlineWrite(track.element, constant.property);
        writeTrack(track, 0);
      }

      if (input.role === "active" && !player.started) {
        player.started = true;
        driverPolicy.beginRun();
        scheduleFrame(taskId, player);
      }

      return () => {
        track.detached = true;
        // Strip this track's inline writes HERE, not in a status-effect: a
        // covered prev screen FREEZES in the same commit that completes the
        // transition, so its COMPLETED effect never runs — but React still
        // runs this cleanup on the way into the freeze. Idempotent with the
        // engine's COMPLETED cleanup for unfrozen screens. A scrub's
        // fill-"both" end-state outranks the compiled rest rules (animation
        // origin), so it must be cancelled here for the handoff.
        track.scrub?.cancel();
        clearInlineAnimation(track.element);
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
      // Re-anchor across a main-thread stall (see MAX_CLOCK_STEP_MS): push the
      // anchor forward by the excess so progress resumes at most two frames
      // past where it stalled rather than leaping ahead — the animation plays
      // every value of its authored curve, just late. Scrub-WAAPI tracks
      // derive currentTime from this same startTime, so they re-anchor with
      // it automatically.
      if (gap > MAX_CLOCK_STEP_MS) {
        startTime += gap - MAX_CLOCK_STEP_MS;
      }
    }
    player.startTime = startTime;
    player.lastTime = time;

    let allDone = true;
    for (const track of player.tracks) {
      if (track.completed || track.detached) continue;
      const durationMs = track.motion.duration * 1000;
      const delayMs = track.motion.delay * 1000;
      const elapsed = time - startTime;

      if (track.scrub) {
        // The browser interpolates; we only advance its clock. Raw (uneased)
        // time — the easing lives in the animation's own timing function.
        const totalMs = delayMs + durationMs;
        track.scrub.currentTime = Math.min(Math.max(0, elapsed), totalMs);
        if (elapsed >= totalMs) {
          track.completed = true;
          track.onComplete?.();
        } else {
          allDone = false;
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
      }
    }

    if (allDone) {
      driverPolicy.endRun();
      players.delete(taskId);
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

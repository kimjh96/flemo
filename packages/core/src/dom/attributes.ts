// THE DOM PROTOCOL.
//
// flemo's packages do not talk to each other through TypeScript alone. The
// binding RENDERS a set of `data-flemo-*` attributes, the compiled stylesheet
// SELECTS on them, the engine READS and WRITES them, and @flemo/devtools
// OBSERVES them from outside. That set is the real interface between the
// packages — and until this module existed it was ~27 string literals spread
// across four packages, so renaming one broke the others silently: no type
// error, no failing test, just a transition that quietly stopped animating.
//
// Every attribute name in the library now comes from here. Three rules:
//
// 1. NEVER inline a `data-flemo-*` string. Import the constant, and build
//    selectors with `attrSelector`/`attrValueSelector` so the name appears
//    exactly once.
// 2. These names are a PUBLIC contract. Consumers style on them, e2e suites
//    query them, and @flemo/devtools reads them out of a page it does not
//    control. Renaming one is a breaking change for all three.
// 3. A new attribute belongs in this table with its WRITER and its READERS
//    named. An attribute whose writer no one can find is how the last round of
//    orphaned markers happened.
//
// @flemo/devtools deliberately does NOT import this module at runtime — it is
// a zero-dependency observer of a page whose flemo version it cannot assume.
// It keeps its own copy of the names it reads, and a test there asserts the
// copy against this table, so the duplication cannot drift.

/** Shared prefix. Every attribute below starts with it. */
export const FLEMO_ATTR_PREFIX = "data-flemo-";

// ── Screen identity and flight state ────────────────────────────────────────
// Written by the binding on every screen scope; read by the engine (to find
// participants), by the compiled variant rules (which select on
// status/active), and by devtools (which reconstructs flights from the flips).

/** Marks a screen scope. Presence only — the value carries nothing. */
export const SCREEN_ATTR = "data-flemo-screen";

/** The navigation status this screen is rendering: a `NavigateStatus` value. */
export const STATUS_ATTR = "data-flemo-status";

/** `"true"` on the screen the navigation is moving TO, `"false"` on its partner. */
export const ACTIVE_ATTR = "data-flemo-active";

/** The resolved transition name, so the compiled rules select the right keyframes. */
export const TRANSITION_ATTR = "data-flemo-transition";

/**
 * The owning Router's identity. The engine scopes a flight's choreography
 * participants by this marker rather than by DOM structure: each screen sits in
 * its own wrapper, a root Router renders no container, and two independent
 * Routers may share a DOM parent — so structure cannot draw the line.
 */
export const ROUTER_ATTR = "data-flemo-router";

/**
 * `"true"` suppresses this screen's motion for one flight (an interrupted or
 * restored navigation that must land without animating).
 */
export const SKIP_ANIMATION_ATTR = "data-flemo-skip-animation";

// ── Shared bars ─────────────────────────────────────────────────────────────
// A shared bar is a top/bottom chrome element handed between two screens. It
// carries its own status/active pair because it can be riding one screen's
// keyframes while belonging to another.

/** Marks a shared bar element. */
export const BAR_ATTR = "data-flemo-bar";

/** The bar's own active flag (see ACTIVE_ATTR). */
export const BAR_ACTIVE_ATTR = "data-flemo-bar-active";

/** The bar's own status (see STATUS_ATTR). */
export const BAR_STATUS_ATTR = "data-flemo-bar-status";

/**
 * `"true"` while the bar RIDES its screen's keyframes — the compiled rule pairs
 * the bar selector with the screen rule, so the pair moves in lockstep.
 */
export const BAR_RIDING_ATTR = "data-flemo-bar-riding";

/** The consumer-supplied shared-bar id, used to match a bar across screens. */
export const BAR_ID_ATTR = "data-flemo-bar-id";

/** The id's `typeof`, so `1` and `"1"` never match as the same bar. */
export const BAR_ID_TYPE_ATTR = "data-flemo-bar-id-type";

/** The transition name driving this bar. */
export const BAR_TRANSITION_ATTR = "data-flemo-bar-transition";

/** The layout spacer that reserves a shared bar's height in the screen flow. */
export const BAR_SPACER_ATTR = "data-flemo-bar-spacer";

// ── Decorator ───────────────────────────────────────────────────────────────

/** Marks the decorator element (the dim/overlay layer between screens). */
export const DECORATOR_ATTR = "data-flemo-decorator";

/** The decorator definition's name, for its own compiled rules. */
export const DECORATOR_NAME_ATTR = "data-flemo-decorator-name";

// ── Parts ───────────────────────────────────────────────────────────────────

/**
 * A `<Part>`'s registered part-transition name. Parts self-carry their screen's
 * status/active (STATUS_ATTR/ACTIVE_ATTR) so the compiled part selectors and
 * the engine's participant scan can both find them.
 */
export const PART_NAME_ATTR = "data-flemo-part-name";

// ── Holds ───────────────────────────────────────────────────────────────────
// The holds are how a flight's opening survives a heavy mount commit: the
// compiled rules pause on these attributes, and the release flips them.

/**
 * The animation hold. `"true"` pauses this element's compiled animation (and
 * its descendant parts) at the from-pose; `"park"` parks it at its
 * destination instead; `"false"` releases. The release flip is the moment a
 * flight's clock starts.
 */
export const ANIM_HOLD_ATTR = "data-flemo-anim-hold";

/**
 * The values ANIM_HOLD_ATTR takes. These are as much of the contract as the
 * attribute name: the binding writes them, the compiled stylesheet generates
 * one rule per parked form, and the engine's release watch compares against
 * RELEASED. All four "held" forms pause the animation; they differ in where
 * the held element sits while it waits.
 */
export const ANIM_HOLD = {
  /** Paused at the keyframe's from-pose. */
  HELD: "true",
  /** Released — the flight's clock starts on this write. */
  RELEASED: "false",
  /** Pre-positioned at its DESTINATION, under an opaque cover. */
  PARK: "park",
  /** The push-side mirror: the entering screen parked BELOW its cover. */
  PARK_UNDER: "park-under",
  /** The promoted variant of PARK_UNDER, kept above so its raster survives. */
  PARK_OVER: "park-over"
} as const;

/** The values the compiled hold rule must pause on. */
export const ANIM_HOLD_PAUSED_VALUES = [
  ANIM_HOLD.HELD,
  ANIM_HOLD.PARK,
  ANIM_HOLD.PARK_UNDER,
  ANIM_HOLD.PARK_OVER
] as const;

/** Marks content parked by the in-flight arrival hold, pending its landing. */
export const HELD_ARRIVAL_ATTR = "data-flemo-held-arrival";

/** Marks an `<img>` whose reveal is held to the flight's rest. */
export const IMAGE_HOLD_ATTR = "data-flemo-img-hold";

// ── Per-platform head gates (stamped on the root element) ───────────────────
// A "head" is a flat opening segment baked into the keyframes, so a commit
// that ages the wall clock eats the head instead of the curve's start. Which
// head a session gets is a platform decision; these attributes gate the
// compiled rules that implement each one.

/** The governed (touch WebKit) head kit. */
export const GOVERNED_ATTR = "data-flemo-governed";

/** The creep head: the head's end keyframe carries a hair of motion. */
export const CREEP_ATTR = "data-flemo-creep";

/** The desktop macOS Safari flat head, with its own lengths. */
export const DESK_HEAD_ATTR = "data-flemo-desk-head";

// ── Engine-owned runtime markers ────────────────────────────────────────────
// Written and read only by the engine. Listed here anyway: the names are still
// in the page, and a consumer or a devtools build must be able to recognise
// flemo's own scratch elements rather than mistake them for app content.

/** The compositor warm-up element. */
export const WARM_ATTR = "data-flemo-warm";

/** The warm-up's cadence video, when the desktop profile uses one. */
export const WARM_VIDEO_ATTR = "data-flemo-warm-video";

/** The one-shot GPU pipeline prewarm element. */
export const GPU_PREWARM_ATTR = "data-flemo-gpu-prewarm";

/**
 * An offloaded `<img>`'s AUTHORED source, kept while `src` points at the
 * decoded-to-scale replacement.
 */
export const OFFLOADED_SRC_ATTR = "data-flemo-image-src";

// ── Reserved for @flemo/devtools ────────────────────────────────────────────

/**
 * The devtools panel's shadow host. Owned by @flemo/devtools, reserved here so
 * the name cannot be reused and so the engine's own scans can skip it.
 */
export const DEVTOOLS_PANEL_ATTR = "data-flemo-devtools-panel";

// ── Selector helpers ────────────────────────────────────────────────────────

/** `[data-flemo-screen]` — presence selector for one attribute. */
export const attrSelector = (attribute: string): string => `[${attribute}]`;

/** `[data-flemo-status="PUSHING"]` — value selector for one attribute. */
export const attrValueSelector = (attribute: string, value: string): string =>
  `[${attribute}="${value}"]`;

/**
 * Every attribute this library writes. Exported so a consumer, an e2e suite or
 * a devtools build can assert against the shipped set instead of a hand-kept
 * copy — the drift this module exists to end.
 */
export const FLEMO_ATTRIBUTES = [
  SCREEN_ATTR,
  STATUS_ATTR,
  ACTIVE_ATTR,
  TRANSITION_ATTR,
  ROUTER_ATTR,
  SKIP_ANIMATION_ATTR,
  BAR_ATTR,
  BAR_ACTIVE_ATTR,
  BAR_STATUS_ATTR,
  BAR_RIDING_ATTR,
  BAR_ID_ATTR,
  BAR_ID_TYPE_ATTR,
  BAR_TRANSITION_ATTR,
  BAR_SPACER_ATTR,
  DECORATOR_ATTR,
  DECORATOR_NAME_ATTR,
  PART_NAME_ATTR,
  ANIM_HOLD_ATTR,
  HELD_ARRIVAL_ATTR,
  IMAGE_HOLD_ATTR,
  GOVERNED_ATTR,
  CREEP_ATTR,
  DESK_HEAD_ATTR,
  WARM_ATTR,
  WARM_VIDEO_ATTR,
  GPU_PREWARM_ATTR,
  OFFLOADED_SRC_ATTR,
  DEVTOOLS_PANEL_ATTR
] as const;

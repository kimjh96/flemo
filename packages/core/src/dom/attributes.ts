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

/**
 * Marks a screen scope, and carries that screen's id.
 *
 * The value was empty until a `<Layer>` slot needed to name the screen it
 * belongs to from the DOM alone. Presence selectors are unaffected, which is
 * what every existing reader uses; nothing may start requiring the value.
 */
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

/**
 * The screen a decorator belongs to, on every copy of it.
 *
 * A decorator is not one element. A screen with a `<Layer>` slot renders its
 * dim TWICE — once in its own container, once portalled into the layer host so
 * the dim also covers what the overlay carried out of the screen — and the
 * copy is the one that paints on top. Everything that has to reach "this
 * screen's dim" was reaching the in-container one by a ref or an own-child
 * query, so the copy, which is what the eye is on, was reached by nothing: a
 * swipe drove the original under it while the visible one stood still.
 *
 * The id is the screen's, so a lookup names the OWNER rather than a position,
 * and finds however many copies that owner rendered.
 */
export const DECORATOR_OWNER_ATTR = "data-flemo-decorator-owner";

// ── Layers (consumer overlays that had to leave the screen) ─────────────────
// A moving screen is a containing block for `position: fixed` descendants AND
// a stacking context around all of them, while the shared bars are siblings
// outside it. So an overlay that must cover the bars cannot be written inside
// the screen: content and overlay have to sit in different stacking contexts,
// and there is no z-index arrangement inside one that interleaves them.
//
// <Layer> is that separation, and these two attributes are its whole surface.

/**
 * The HOST: one childless box per screen chain, rendered by the OUTERMOST
 * screen's container and inherited by every screen nested inside it. Outermost
 * because an overlay has to clear the chrome of every screen above its own,
 * and chrome declared by an ancestor sits outside that ancestor's scope.
 *
 * It is `position: absolute` and full-size so a consumer's absolutely
 * positioned overlay has the region to anchor to, and it never takes a pointer
 * itself — a host with nothing in it must not swallow taps meant for the
 * screen underneath.
 */
export const LAYER_HOST_ATTR = "data-flemo-layer-host";

/**
 * A SLOT: one per `<Layer>`, portaled into the host, carrying its owning
 * screen's identity. This is what keeps the escape from becoming an orphan —
 * the slot leaves the screen's box for PAINT ORDER only, and takes the rest of
 * being that screen with it:
 *
 * - it stacks by its owner's position, so two screens' overlays order the way
 *   their screens do rather than by portal mount order
 * - it carries its owner's status/active/transition, so the compiled screen
 *   rule animates it in lockstep and it leaves WITH its screen (the same
 *   pairing a riding shared bar uses)
 * - it mirrors its owner's paint-hidden state, which `visibility: hidden` on
 *   the screen container cannot reach across a portal
 *
 * Unmounting is React's: the slot is rendered from inside its screen's
 * subtree, so it dies with the screen without anything having to notice.
 */
export const LAYER_SLOT_ATTR = "data-flemo-layer-slot";

/**
 * The id (see SCREEN_ATTR) of the screen a slot belongs to.
 *
 * A slot sits in an ancestor's host, so nothing about where it IS says whose
 * it is. The gesture driver needs to: a drag moves a screen by writing inline
 * styles frame by frame rather than through the compiled rules, so it has to
 * enumerate everything that rides along, and it finds those by walking the
 * moving screen's container. A slot is not in that container. This is how it
 * is found anyway — the same problem a shared bar does not have, because a bar
 * never leaves the container it belongs to.
 */
export const LAYER_OWNER_ATTR = "data-flemo-layer-owner";

// ── Parts ───────────────────────────────────────────────────────────────────

/**
 * A `<Part>`'s registered part-transition name. Parts self-carry their screen's
 * status/active (STATUS_ATTR/ACTIVE_ATTR) so the compiled part selectors and
 * the engine's participant scan can both find them.
 */
export const PART_NAME_ATTR = "data-flemo-part-name";

/**
 * The per-Router PART LAYER: the box a shared bar's `<Part>` elements are staged
 * in for a flight. Rendered by the binding, for the same reason the morph layer
 * is (only a Router knows which box bounds its screens).
 *
 * Two screens that share a bar id each render their OWN copy of that bar inside
 * their own screen container, and a screen container is an isolated stacking
 * context carrying the screen's z-index. So the lower screen's parts are painted
 * under the upper screen's opaque surface: both parts run their authored
 * keyframes, but only one of them is ever seen, and the cross-fade the pair was
 * written for never appears. Being covered is a property of being a descendant,
 * so for the flight the covered side's parts stop being one.
 */
export const PART_LAYER_ATTR = "data-flemo-part-layer";

/**
 * On a staged part: the `data-flemo-screen` id of the screen it was lifted from.
 * The engine's participant scan is otherwise structural (it walks out from the
 * scope), and a staged part is no longer under any scope — without this it would
 * drop out of the layer pin, the settle release and the COMPLETED inline clear,
 * all of which must keep treating it as one of its screen's parts.
 */
export const PART_HOME_ATTR = "data-flemo-part-home";

/**
 * The box left behind in the bar while a part is staged.
 *
 * A part is a child of its bar's layout, so lifting it out shrinks the bar by
 * exactly its size and everything after it slides over. That is invisible on
 * the covered side and very visible on the other: a pop's staged part belongs
 * to the RETURNING screen, whose bar is the one left on screen at the landing.
 * Measured, it moved the title 56px and moved it back on release.
 */
export const PART_STAND_IN_ATTR = "data-flemo-part-stand-in";

// ── Morphs (shared elements) ────────────────────────────────────────────────
// A morph is one element that exists on BOTH screens of a flight under the
// same `layoutId`. The binding marks it; the morph runtime (see @morph) pairs
// the two sides, emits the per-flight keyframes, and stamps the role.

/**
 * Marks a registered morph element. Presence only — the value is the ROLE
 * (see MORPH_ROLE). Written by the binding, read by the morph runtime (to find
 * the pair), by the compiled hold rule (so a morph pauses with its screen),
 * and by devtools.
 */
export const MORPH_ATTR = "data-flemo-morph";

/** The morph's side of the flight, stamped by the runtime for its duration. */
export const MORPH_ROLE = {
  /** The arriving element: it travels from its partner's rect to its own. */
  ENTER: "enter",
  /** The element left behind: it stays put and trades places with the arrival. */
  EXIT: "exit"
} as const;

/**
 * The registered morph-transition name for this element, so a consumer can run
 * different morph choreography per element. Absent means the default preset.
 */
export const MORPH_NAME_ATTR = "data-flemo-morph-name";

/**
 * The PAIRING KEY (`layoutId`), written out so the pairing is observable.
 *
 * The runtime keeps the key in its own registry and never needed it in the DOM,
 * which made the single most common morph failure — two ends that never paired
 * — invisible to everything outside the runtime: the element simply does not
 * fly, and nothing on the page says why. Four separate investigations began by
 * rebuilding a private tracer to answer "did these two find each other".
 *
 * With the key on the element, an inspector (and `@flemo/devtools`) can group
 * the ends itself and report a pairable set that never flew. Written once and
 * only when it changes — a morph is re-registered on every status change, and
 * an attribute write invalidates that element's style (see the ownership note
 * in attachMorph, where two such writes were device-measured as judder).
 */
export const MORPH_ID_ATTR = "data-flemo-morph-id";

/**
 * The per-Router FLIGHT LAYER: the box a shared element is staged in while it
 * travels. Rendered by the binding (a Router knows which box bounds its
 * screens); the morph runtime moves the element in at the start of a flight and
 * back on landing. A morph inside a screen would be clipped by it, covered by
 * it and dragged along with it — all three are properties of being a
 * descendant, so for the flight it stops being one.
 */
export const MORPH_LAYER_ATTR = "data-flemo-morph-layer";

/**
 * The morph's placeholder: the box that stays behind in the layout, at the
 * element's own size, while the element itself is up in the flight layer. It is
 * what keeps the arriving screen laid out exactly as it will be at rest, so the
 * landing has somewhere true to land.
 */
export const MORPH_SLOT_ATTR = "data-flemo-morph-slot";

/**
 * The STAND-IN: a copy of the element that is flying, left in its slot to hold
 * its place in the layout.
 *
 * A placeholder measured in pixels is a placeholder that can be wrong, and
 * "wrong" here is a layout shift lasting exactly as long as the flight. A copy
 * of the element cannot be: the layout has no way to tell it apart from what
 * was there — same box, same margins, same baseline. It paints nothing and
 * takes no input, and it is replaced by the real element on landing. Owned
 * entirely by the morph runtime.
 */
export const MORPH_STAND_IN_ATTR = "data-flemo-morph-stand-in";

/**
 * The GHOST: a copy of the element being replaced, carried inside the flight so
 * the travelling box shows what was actually there at the start instead of the
 * arrival's content squeezed into the departure's size. It cross-fades into the
 * real element and is removed on landing. Owned entirely by the morph runtime.
 */
export const MORPH_GHOST_ATTR = "data-flemo-morph-ghost";

/**
 * The SCREEN a flight is driving as a camera, stamped with the flight's id.
 *
 * A morph with `carry: "screen"` does not just move its element: it moves the
 * whole screen the element is small on, by exactly the zoom that takes the
 * element from one end of the flight to the other. Everything else on that
 * screen is then dragged along and pushed out of frame, which is what makes a
 * container transform read as one camera move rather than as one card
 * escaping a grid that stayed behind.
 *
 * The id is in the value because two flights can overlap: the rule that
 * matches is the one whose keyframes are still in the sheet.
 */
export const MORPH_CAMERA_ATTR = "data-flemo-morph-camera";

/**
 * The `<style>` tag the morph runtime writes its per-flight keyframes into. A
 * morph's geometry only exists once two rects do, so unlike every other
 * animation in the library its keyframes cannot be compiled at registration —
 * they are inserted when a flight starts and dropped when it lands. Kept out of
 * the compiled sheet so that sheet stays a pure function of the definitions.
 */
export const MORPH_SHEET_ATTR = "data-flemo-morph-sheet";

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

/**
 * The governed head PARKS instead of hiding — written on the entering screen's
 * scope, not the root, because the decision is per-flight.
 *
 * The plain governed head holds the authored from-pose, which for an entering
 * screen is fully off-screen, for `animation-delay` plus the head — 200ms on a
 * PUSHING flight. WebKit drops a backing store that sits outside the coverage
 * rect that long, so the pre-raster the park-over hold just paid for is thrown
 * away and the slide reveals unrastered content (device-recorded 2026-08-30,
 * iOS Safari: everything past the first ~512px tile row entered blank and the
 * re-raster landed 183ms into the flight). Under this attribute the head holds
 * the PARK pose instead — on-screen at the destination, near-zero opacity, the
 * same place the hold already had it — so the tiles stay live across the wait.
 *
 * The binding writes it only where the park-over hold itself was granted (the
 * covering screen's surface is verifiably opaque), so a translucent cover keeps
 * the old off-screen head rather than showing a ghost.
 */
export const PARK_HEAD_ATTR = "data-flemo-park-head";

// ── Engine-owned runtime markers ────────────────────────────────────────────
// Written and read only by the engine. Listed here anyway: the names are still
// in the page, and a consumer or a devtools build must be able to recognise
// flemo's own scratch elements rather than mistake them for app content.

/**
 * The compositor warm-up element. Its VALUE says whether the warm-up is
 * currently forcing frames (`"on"`) or resident but idle (`"idle"`) — the
 * element outlives every hold, so its presence alone no longer answers that.
 */
export const WARM_ATTR = "data-flemo-warm";

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
  DECORATOR_OWNER_ATTR,
  LAYER_HOST_ATTR,
  LAYER_OWNER_ATTR,
  LAYER_SLOT_ATTR,
  PART_NAME_ATTR,
  PART_LAYER_ATTR,
  PART_HOME_ATTR,
  PART_STAND_IN_ATTR,
  MORPH_ATTR,
  MORPH_CAMERA_ATTR,
  MORPH_GHOST_ATTR,
  MORPH_ID_ATTR,
  MORPH_LAYER_ATTR,
  MORPH_NAME_ATTR,
  MORPH_SLOT_ATTR,
  MORPH_STAND_IN_ATTR,
  MORPH_SHEET_ATTR,
  ANIM_HOLD_ATTR,
  HELD_ARRIVAL_ATTR,
  IMAGE_HOLD_ATTR,
  GOVERNED_ATTR,
  CREEP_ATTR,
  DESK_HEAD_ATTR,
  PARK_HEAD_ATTR,
  WARM_ATTR,
  GPU_PREWARM_ATTR,
  OFFLOADED_SRC_ATTR,
  DEVTOOLS_PANEL_ATTR
] as const;

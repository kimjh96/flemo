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

// ── Screen identity and transition state ────────────────────────────────────────
// Written by the binding on every screen scope; read by the engine (to find
// participants), by the compiled variant rules (which select on
// status/active), and by devtools (which reconstructs transitions from the flips).

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

/**
 * Which screen of the pair is the STACK's top, not which one is the new screen.
 * `"true"` is the top screen and `"false"` its partner, so on a push the new
 * screen is `"true"` and on a pop the new screen is `"false"`: the closing
 * screen stays top until it is gone. Reading this as "the new screen" pairs a
 * morph backwards on every pop.
 */
export const ACTIVE_ATTR = "data-flemo-active";

/** The resolved transition name, so the compiled rules select the right keyframes. */
export const TRANSITION_ATTR = "data-flemo-transition";

/**
 * The identity of the Router that renders this screen. The engine finds the
 * elements that move in a transition by this marker rather than by DOM
 * structure: each screen sits in its own wrapper, a root Router renders no
 * container, and two independent Routers may share a DOM parent, so structure
 * cannot draw the line.
 */
export const ROUTER_ATTR = "data-flemo-router";

/**
 * `"true"` suppresses this screen's motion for one transition (an interrupted or
 * restored navigation that must end without animating).
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
 * `"true"` while the bar follows its screen's keyframes. The compiled rule pairs
 * the bar selector with the screen rule, so the two move in lockstep.
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
 * because an overlay has to cover the headers and tab bars of every screen
 * above its own, and a header declared by an ancestor sits outside that
 * ancestor's scope.
 *
 * It is `position: absolute` and full-size so a consumer's absolutely
 * positioned overlay has the region to anchor to, and it never takes a pointer
 * itself: a host with nothing in it must not swallow taps meant for the
 * screen behind it.
 */
export const LAYER_HOST_ATTR = "data-flemo-layer-host";

/**
 * A SLOT: one per `<Layer>`, portaled into the host, with the identity of the
 * screen it belongs to. This keeps the slot tied to its screen: it leaves the
 * screen's box for RENDER ORDER only, and keeps everything else about being
 * that screen:
 *
 * - it stacks by its screen's position, so two screens' overlays order the way
 *   their screens do rather than by portal mount order
 * - it copies its screen's status/active/transition, so the compiled screen
 *   rule animates it in lockstep and it leaves WITH its screen (the same
 *   pairing a shared bar uses when it follows its screen)
 * - it mirrors its screen's hidden state, which `visibility: hidden` on
 *   the screen container cannot reach across a portal
 *
 * Unmounting is React's: the slot is rendered from inside its screen's
 * subtree, so it unmounts with the screen without anything having to notice.
 */
export const LAYER_SLOT_ATTR = "data-flemo-layer-slot";

/**
 * The id (see SCREEN_ATTR) of the screen a slot belongs to.
 *
 * A slot sits in an ancestor's host, so nothing about where it IS says whose
 * it is. The gesture driver needs to know: a drag moves a screen by writing
 * inline styles frame by frame rather than through the compiled rules, so it
 * has to list everything that follows the swipe, and it finds those by walking
 * the moving screen's container. A slot is not in that container. This is how
 * it is found anyway. A shared bar does not have this problem, because a bar
 * never leaves the container it belongs to.
 */
export const LAYER_OWNER_ATTR = "data-flemo-layer-owner";

// ── Parts ───────────────────────────────────────────────────────────────────

/**
 * A `<Part>`'s registered part-transition name. Parts copy their screen's
 * status/active (STATUS_ATTR/ACTIVE_ATTR) onto themselves so the compiled part
 * selectors and the engine's scan for elements that move can both find them.
 */
export const PART_NAME_ATTR = "data-flemo-part-name";

/**
 * The per-Router PART LAYER: the box a shared bar's `<Part>` elements are staged
 * in for a transition. Rendered by the binding, for the same reason the morph layer
 * is (only a Router knows which box bounds its screens).
 *
 * Two screens that share a bar id each render their OWN copy of that bar inside
 * their own screen container, and a screen container is an isolated stacking
 * context with the screen's z-index. So the lower screen's parts render
 * under the upper screen's opaque surface: both parts run their authored
 * keyframes, but only one of them is ever seen, and the cross-fade the pair was
 * written for never appears. Being covered is a property of being a descendant,
 * so for the transition the covered side's parts stop being one.
 */
export const PART_LAYER_ATTR = "data-flemo-part-layer";

/**
 * On a staged part: the `data-flemo-screen` id of the screen it was lifted from.
 * The engine's scan for elements that move is otherwise structural (it walks out
 * from the scope), and a staged part is no longer under any scope. Without this
 * it would drop out of the layer pin, the release when the transition ends and
 * the COMPLETED inline clear, all of which must keep treating it as one of its
 * screen's parts.
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
// A morph is one element that exists on BOTH screens of a transition under the
// same `layoutId`. The binding marks it; the morph runtime (see @morph) pairs
// the two sides, emits the per-transition keyframes, and stamps the role.

/**
 * Marks a registered morph element. Presence only; the value is the ROLE
 * (see MORPH_ROLE). Written by the binding, read by the morph runtime (to find
 * the pair), by the compiled rule that pauses a screen before its transition
 * starts (so a morph pauses with its screen), and by devtools.
 */
export const MORPH_ATTR = "data-flemo-morph";

/** The morph's side of the transition, stamped by the runtime for its duration. */
export const MORPH_ROLE = {
  /** The element on the new screen: it moves from its partner's rect to its own. */
  ENTER: "enter",
  /** The element on the old screen: it stays put and trades places with the new one. */
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
 * move, and nothing on the page says why. Four separate investigations began by
 * rebuilding a private tracer to answer "did these two find each other".
 *
 * With the key on the element, an inspector (and `@flemo/devtools`) can group
 * the ends itself and report a pairable set that never moved. Written once and
 * only when it changes — a morph is re-registered on every status change, and
 * an attribute write invalidates that element's style (see the ownership note
 * in attachMorph, where two such writes were device-measured as judder).
 */
export const MORPH_ID_ATTR = "data-flemo-morph-id";

/**
 * The per-Router MORPH LAYER: the box a shared element is staged in while it
 * moves. Rendered by the binding (a Router knows which box bounds its
 * screens); the morph runtime moves the element in at the start of a transition and
 * back when the transition ends. A morph inside a screen would be clipped by it,
 * covered by it and dragged along with it. All three are properties of being a
 * descendant, so for the transition it stops being one.
 */
export const MORPH_LAYER_ATTR = "data-flemo-morph-layer";

/**
 * The morph's placeholder: the box that stays behind in the layout, at the
 * element's own size, while the element itself is in the morph layer. It keeps
 * the new screen laid out exactly as it will be at rest, so the element has the
 * correct place to end at.
 */
export const MORPH_SLOT_ATTR = "data-flemo-morph-slot";

/**
 * The STAND-IN: a copy of the element that is moving, left in its slot to keep
 * its place in the layout.
 *
 * A placeholder measured in pixels is a placeholder that can be wrong, and
 * "wrong" here is a layout shift lasting exactly as long as the transition. A copy
 * of the element cannot be: the layout has no way to tell it apart from what
 * was there (same box, same margins, same baseline). It renders nothing and
 * takes no input, and it is replaced by the real element when the transition
 * ends. Managed entirely by the morph runtime.
 */
export const MORPH_STAND_IN_ATTR = "data-flemo-morph-stand-in";

/**
 * The GHOST: a copy of the element being replaced, moved along with the
 * transition so the moving box shows what was actually there at the start
 * instead of the new element's content squeezed into the old element's size. It
 * cross-fades into the real element and is removed when the transition ends.
 * Managed entirely by the morph runtime.
 */
export const MORPH_GHOST_ATTR = "data-flemo-morph-ghost";

/**
 * The shadow CARRIER: a box around a revealed moving element that casts its
 * shadow for it.
 *
 * A reveal cuts the box back with a clip, and a clip takes everything painted
 * outside the border box with it, so a revealed box's own shadow is never
 * drawn; a filter on the element is applied before the clip and is eaten the
 * same way. The carrier sits outside the clip and casts the shadow of the
 * silhouette the clip leaves. It paints nothing else, takes no pointer events,
 * and is removed on landing. Owned entirely by the morph runtime.
 */
export const MORPH_SHADE_ATTR = "data-flemo-morph-shade";

/**
 * The SCREEN a morph with `carry: "screen"` is moving, stamped with the
 * transition's id.
 *
 * A morph with `carry: "screen"` does not just move its element: it moves the
 * whole screen the element is small on, by exactly the zoom that takes the
 * element from one end of the transition to the other. Everything else on that
 * screen is then moved along and pushed out of view, so a container transform
 * reads as one zoom of the whole screen rather than as one card leaving a grid
 * that stayed behind.
 *
 * The id is in the value because two transitions can overlap: the rule that
 * matches is the one whose keyframes are still in the sheet.
 */
export const MORPH_CAMERA_ATTR = "data-flemo-morph-camera";

/**
 * The `<style>` tag the morph runtime writes its per-transition keyframes into. A
 * morph's geometry only exists once two rects do, so unlike every other
 * animation in the library its keyframes cannot be compiled at registration.
 * They are inserted when a transition starts and dropped when it ends. Kept out of
 * the compiled sheet so that sheet stays a pure function of the definitions.
 */
export const MORPH_SHEET_ATTR = "data-flemo-morph-sheet";

// ── Holds ───────────────────────────────────────────────────────────────────
// The holds are how a transition's opening survives a heavy mount commit: the
// compiled rules pause on these attributes, and the release flips them.

/**
 * Pauses an animation before it starts. `"true"` pauses this element's compiled
 * animation (and its descendant parts) at its starting style; `"park"` places
 * it at its end position instead; `"false"` lets it run. Writing `"false"` is
 * the moment a transition's timing starts.
 */
export const ANIM_HOLD_ATTR = "data-flemo-anim-hold";

/**
 * The values ANIM_HOLD_ATTR takes. These are as much of the contract as the
 * attribute name: the binding writes them, the compiled stylesheet generates
 * one rule per paused form, and the engine compares against RELEASED to see
 * when the animation starts. All four paused forms pause the animation; they
 * differ in where the paused element sits while it waits.
 */
export const ANIM_HOLD = {
  /** Paused at the keyframe's starting style. */
  HELD: "true",
  /** Running: the transition's timing starts on this write. */
  RELEASED: "false",
  /** Placed at its END position ahead of time, under an opaque screen that covers it. */
  PARK: "park",
  /** The push-side mirror: the new screen placed BELOW the screen that covers it. */
  PARK_UNDER: "park-under",
  /** The variant of PARK_UNDER on its own compositor layer, kept above so its rendered pixels are kept. */
  PARK_OVER: "park-over"
} as const;

/** The values the compiled hold rule must pause on. */
export const ANIM_HOLD_PAUSED_VALUES = [
  ANIM_HOLD.HELD,
  ANIM_HOLD.PARK,
  ANIM_HOLD.PARK_UNDER,
  ANIM_HOLD.PARK_OVER
] as const;

/** Marks content on the new screen that is hidden until the transition ends. */
export const HELD_ARRIVAL_ATTR = "data-flemo-held-arrival";

/** Marks an `<img>` that stays hidden until the transition ends. */
export const IMAGE_HOLD_ATTR = "data-flemo-img-hold";

// ── Per-platform head gates (stamped on the root element) ───────────────────
// A "head" is a flat opening segment baked into the keyframes, so a commit
// that ages the wall clock eats the head instead of the curve's start. Which
// head a session gets is a platform decision; these attributes gate the
// compiled rules that implement each one.

/** The governed (touch WebKit) head kit. */
export const GOVERNED_ATTR = "data-flemo-governed";

/** The creep head: the head's end keyframe includes a tiny amount of motion. */
export const CREEP_ATTR = "data-flemo-creep";

/** The desktop macOS Safari flat head, with its own lengths. */
export const DESK_HEAD_ATTR = "data-flemo-desk-head";

/**
 * The governed head keeps the new screen at its end position (the `"park"` style)
 * instead of hiding it. Written on the new screen's scope, not the root, because
 * the decision is per-transition.
 *
 * The plain governed head keeps the authored starting style, which for a new
 * screen is fully off-screen, for `animation-delay` plus the head: 200ms on a
 * PUSHING transition. WebKit drops a backing store that sits outside the coverage
 * rect that long, so the pre-rendering the park-over hold just paid for is thrown
 * away and the slide shows content that is not rendered yet (device-recorded
 * 2026-08-30, iOS Safari: everything past the first ~512px tile row entered blank
 * and the re-render finished 183ms into the transition). Under this attribute the
 * head keeps the `"park"` style instead (on-screen at the end position, near-zero
 * opacity, the same place the paused screen already had it), so the tiles stay
 * live across the wait.
 *
 * The binding writes it only where the park-over hold itself was granted (the
 * covering screen's surface is verifiably opaque), so a translucent covering
 * screen keeps the old off-screen head rather than showing a ghost.
 */
export const PARK_HEAD_ATTR = "data-flemo-park-head";

// ── Engine-owned runtime markers ────────────────────────────────────────────
// Written and read only by the engine. Listed here anyway: the names are still
// in the page, and a consumer or a devtools build must be able to recognise
// flemo's own scratch elements rather than mistake them for app content.

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
  MORPH_SHADE_ATTR,
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
  GPU_PREWARM_ATTR,
  OFFLOADED_SRC_ATTR,
  DEVTOOLS_PANEL_ATTR
] as const;

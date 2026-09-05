// The `data-flemo-*` names this recorder observes.
//
// DUPLICATED FROM @flemo/core ON PURPOSE. This package attaches to a page whose
// flemo version it does not control and must not assume — a report is most
// valuable exactly when the page is running something older or newer than the
// devtools build. So the recorder reads the DOM with its own copy of the names
// and takes no runtime dependency on core.
//
// The duplication is pinned, not trusted: `__tests__/domProtocol.test.ts`
// imports core's table and asserts this copy against it, so the two cannot
// drift silently the way the flag registry did.
//
// If core adds an attribute this recorder should observe, add it here too and
// the test will confirm the spelling. If core RENAMES one, the test fails and
// the decision is explicit: follow the rename, or keep both spellings so the
// recorder still works against older pages.

export const SCREEN_ATTR = "data-flemo-screen";
export const STATUS_ATTR = "data-flemo-status";
export const ACTIVE_ATTR = "data-flemo-active";
export const ROUTER_ATTR = "data-flemo-router";
export const ANIM_HOLD_ATTR = "data-flemo-anim-hold";
export const IMAGE_HOLD_ATTR = "data-flemo-img-hold";
export const HELD_ARRIVAL_ATTR = "data-flemo-held-arrival";
export const PART_NAME_ATTR = "data-flemo-part-name";
export const DECORATOR_ATTR = "data-flemo-decorator";
export const BAR_ATTR = "data-flemo-bar";
export const BAR_STATUS_ATTR = "data-flemo-bar-status";
export const BAR_RIDING_ATTR = "data-flemo-bar-riding";

// ── Morphs (shared elements) ────────────────────────────────────────────────
// A morph is one element that exists on both screens of a flight under the same
// pairing key. The runtime lifts it into a layer, leaves a stand-in in its
// place, carries a ghost of the element it replaces, and may drive a whole
// screen as a camera. Every one of those is a marked element, so a pure
// observer can tell a morph that FLEW from a pair that never found each other.

/** A registered morph. The value is the role while it flies: "enter"/"exit". */
export const MORPH_ATTR = "data-flemo-morph";

/** The pairing key (the binding's `layoutId`), so the two ends can be grouped. */
export const MORPH_ID_ATTR = "data-flemo-morph-id";

/** The registered morph-transition name, absent/empty meaning the default preset. */
export const MORPH_NAME_ATTR = "data-flemo-morph-name";

/** The per-Router flight layer a staged morph is lifted into. */
export const MORPH_LAYER_ATTR = "data-flemo-morph-layer";

/** The copy left in the layout holding the flying element's place. */
export const MORPH_STAND_IN_ATTR = "data-flemo-morph-stand-in";

/** The copy of the replaced element carried inside the flight. */
export const MORPH_GHOST_ATTR = "data-flemo-morph-ghost";

/** A screen being driven as a camera by a morph, stamped with the flight id. */
export const MORPH_CAMERA_ATTR = "data-flemo-morph-camera";

/** The `<style>` element a morph writes its per-flight keyframes into. */
export const MORPH_SHEET_ATTR = "data-flemo-morph-sheet";

/** The values MORPH_ATTR takes while an element is in the air. */
export const MORPH_ROLES = ["enter", "exit"] as const;

// ── Animation names ─────────────────────────────────────────────────────────
// Every keyframe the library compiles is namespaced, so an animation event can
// be told apart from a consumer's own by its name alone. Not an attribute, so
// the table test above does not cover it: it is pinned by
// `__tests__/domProtocol.test.ts` against a name core actually emits.

/** Every flemo keyframe name starts with this. */
export const FLEMO_ANIMATION_PREFIX = "flemo-";

/** A morph's per-flight keyframes are namespaced again under this. */
export const MORPH_ANIMATION_PREFIX = "flemo-morph-";

/** This package's own marker — core reserves the name but never writes it. */
export const DEVTOOLS_PANEL_ATTR = "data-flemo-devtools-panel";

/** The statuses during which a flight is moving. */
export const TRANSITIONAL_STATUSES = ["PUSHING", "POPPING", "REPLACING"] as const;

/** The ANIM_HOLD_ATTR values that mean "held" (any form of park included). */
export const HOLD_VALUES = ["true", "park", "park-under", "park-over"] as const;

/** `[data-flemo-screen]` */
export const attrSelector = (attribute: string): string => `[${attribute}]`;

/** `[data-flemo-status="PUSHING"]` */
export const attrValueSelector = (attribute: string, value: string): string =>
  `[${attribute}="${value}"]`;

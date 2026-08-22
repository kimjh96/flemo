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

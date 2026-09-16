// WHAT THE SCORER IS ALLOWED TO KNOW ABOUT A SUBMISSION.
//
// Every task variant ends with the same sentence: expose stable `data-eval`
// attributes for eleven roles. That sentence is the whole contract. The scorer
// may not know a submission's component names, routes, class names or file
// layout, because each session writes its own — so a criterion is written
// against these eleven roles plus the `data-flemo-*` surfaces the engine
// publishes for every app it drives.
//
// A MAP EXISTS SO THE SCORER CAN BE REHEARSED. An app that predates the
// contract (this repository's own composition bench) satisfies the same shapes
// under different selectors, and pointing the scorer at it is the only way to
// prove a criterion separates a real flight from a broken one before any
// session is scored. A map never adds a role and never changes what a
// criterion asserts; it only says where each role is.

/** The eleven roles every task prompt requires, in the prompt's own order. */
export const ROLES = [
  "app-home",
  "app-detail",
  "local-list",
  "local-filter",
  "shared-header",
  "shared-title",
  "shared-action",
  "shared-object",
  "shared-text",
  "overlay",
  "overlay-close"
];

// Two roles are named by the prompts as destinations rather than as elements:
// the control that opens the outer screen from inside the local panel, and the
// control that opens the overlay. A submission reaches them through the roles
// above (`app-detail` is opened from `local-list`), so the scorer asks for them
// by role name and falls back to the contract's own attribute.
export const ACTIONS = ["open-detail-from-local", "open-overlay"];

const evalSelector = (role) => `[data-eval="${role}"]`;

/**
 * Resolve the selector for one role or action.
 *
 * Without a map this is the contract itself. With one, a role may be given as
 * a selector string, or as `{ selector }` plus `{ text }` for a control that
 * an app labels rather than marks.
 */
export const resolve = (map, role) => {
  const entry = map?.[role];
  if (entry === undefined || entry === null) return { selector: evalSelector(role), text: null };
  if (typeof entry === "string") return { selector: entry, text: null };
  return { selector: entry.selector ?? evalSelector(role), text: entry.text ?? null };
};

/** Every role a map must cover, so a missing one is reported before a run. */
export const required = () => [...ROLES, ...ACTIONS];

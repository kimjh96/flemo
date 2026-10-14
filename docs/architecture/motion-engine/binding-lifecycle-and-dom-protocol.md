# Binding lifecycle and DOM protocol

This supplement describes the supplied `packages/core/src/core/engine/createTransitionEngine.ts`, `packages/core/src/core/engine/types.ts`, and `packages/core/src/dom/attributes.ts`. Executable engine branches establish lifecycle behavior; attribute declarations and comments establish intended protocol contracts. They do not establish that unseen bindings or helpers implement every contract, or that browser tests have passed.

## Binding inputs and disposal

Create an engine for each screen. Inject `getTransitionTaskId(): string | null`, `setDragStatus`, and `setReplaceTransitionStatus`; both setters accept `"IDLE" | "PENDING"`.

Call `driveScreenLifecycle` from a layout-effect equivalent when its inputs change. Pass transition and previous-transition names, navigation status, active state, `animHoldReleased`, and a live `getElements` callback. Call the returned disposer before the next invocation and on teardown.

`getElements` returns the current nullable animated `scope`, optional decorator, optional bars that may contain null or undefined entries, optional `screenContainer`, and optional `partLayer`. Resolve these live because refs can change after registration. The engine combines bars with `collectLayerRiders(screenContainer)`; a portalled overlay cannot reliably be found through a scope-local ref alone. The binding supplies its Router's part layer because it knows the screen bounds. The declared contract allows omission when the binding has no layer, in which case staging is skipped.

Pass `animHoldReleased: true` when the binding has no hold concept. The type's rAF-player comment is historical: the supplied engine drives compiled animation. `activeResumeEntryCount()` is internal leak-test bookkeeping, not a binding API to depend on.

## Per-pass cleanup

Each lifecycle pass replaces the sweep array. Its disposer captures that array, runs those sweeps first, then runs the branch-specific disposer. Clearing an existing array in place would erase cleanup retained by an earlier pass.

Only the active side stamps unheld outer Parts during an unreleased transitional pass. A released or nontransitional active pass removes stamps found by `collectStampedOuterParts`. Independently, the disposer remembers the exact elements stamped by its own pass and removes their hold only while its value is still `"true"`. This identity-based sweep avoids relying on a detached scope to recover Router membership or broadly sweeping another Router's Parts.

Another sweep reads the live scope and calls `holds.abandon()` if it is absent or disconnected. When initially connected, it checks again in a microtask if that API exists. This distinguishes ordinary effect reruns from detachment at the end of a commit. The invocation is visible in the supplied engine; the implementation of `transitionHolds.abandon` was not supplied.

Staged shared-bar Parts persist across drive calls. Any nontransitional pass releases them before the active/passive branch, including a pop destination that has become active. Passive transitional passes request staging with the supplied part layer and a stranded timeout of `statusChoreographySpanMs(...) + 1500`.

Each engine has its own layer-owner symbol. Bar inline cleanup is owner-scoped because bars may be shared with swipe machinery. Active COMPLETED cleanup force-clears scope leases and explicitly strips `transform` and `opacity`; it also clears skip markers on the scope, screen Parts, and decorator. Active resume budgets are keyed by task ID, removed on resolution, and pruned on stale teardown while surviving reruns of the same task.

## Completion and arrival landing

An accepted scope `animationend` must target the scope and match its expected transition name through `matchesTransitionAnimationName`. If `activeMotion` exists, an event with zero elapsed time is ignored. A clean accepted end detaches its listener and recovery before choreography and presentation deferrals.

The perceptual completion cut is separate from arrival landing. The cut's exact eligibility and the historical early-landing description are in [perceptual landing](lifecycle/perceptual-landing.md). Current `scheduleLanding` invokes its callback two rAFs after scheduling, or immediately without rAF. `landNow` cancels and flushes a pending callback. No early arrival-landing timer remains in the supplied engine.

## Attribute ownership contracts

`attributes.ts` declares public names used by bindings, compiled selectors, the engine, consumers, tests, and devtools. Renaming them is a breaking protocol change. Import constants for imperative operations and use `attrSelector` or `attrValueSelector` to construct selectors. JSX names remain literal under the existing canonical validation rule. Each new attribute must identify its writer and readers. `FLEMO_ATTRIBUTES` enumerates the declared attributes; it does not itself verify their runtime use.

The module explicitly permits devtools to keep its own observed names without a runtime core dependency and describes a test comparing those names with the table. This assessment did not execute that test.

| Family | Declared contract |
| --- | --- |
| Screen identity | `SCREEN_ATTR` carries the screen ID while retaining presence-selector compatibility. Readers must not start requiring its value merely because IDs are now available. `STATUS_ATTR`, `ACTIVE_ATTR`, and `TRANSITION_ATTR` select motion. Active means stack top, including the departing screen on pop. |
| Router and skip | `ROUTER_ATTR` identifies transition ownership independently of DOM ancestry. `SKIP_ANIMATION_ATTR` suppresses motion for a transition and is re-exported from engine types. |
| Shared bars | Bar markers carry their own status, active state, riding state, transition, ID, and ID type. The type distinguishes numeric `1` from string `"1"`. The spacer reserves bar height. |
| Decorators | `DECORATOR_ATTR` and `DECORATOR_NAME_ATTR` identify the dim and its definition. `DECORATOR_OWNER_ATTR` identifies every copy belonging to a screen, including a portalled copy. Consumers needing all copies must use ownership rather than assuming one ref reaches them. |
| Layer host | `LAYER_HOST_ATTR` declares the host supplied by the outermost screen container and inherited by nested screens. Its documented layout is absolute and full-size, and an empty host must not intercept pointers. |
| Layer slots | `LAYER_SLOT_ATTR` identifies a portalled slot. Its declared contract preserves screen stacking, status/active/transition, hidden state, and subtree lifetime. `LAYER_OWNER_ATTR` names its screen even when the slot sits in an ancestor's host. These declarations do not verify the unseen React implementation. |
| Parts | `PART_NAME_ATTR` names a registered transition. `PART_LAYER_ATTR` identifies the Router's staging layer. `PART_HOME_ATTR` records the source screen ID so lifted Parts remain discoverable for engine processing. `PART_STAND_IN_ATTR` marks the layout box left behind while a Part is staged. |
| Morph identity | `MORPH_ATTR` marks a registered element; runtime roles are `enter` and `exit`. `MORPH_NAME_ATTR` selects choreography and `MORPH_ID_ATTR` exposes the pairing key. |
| Morph staging | The morph layer, slot, stand-in, ghost, and shade markers identify staging, reserved layout, replacement paint, and shadow-carrier elements. The camera marker carries the transition ID for a screen-carrying morph. The sheet marker identifies runtime geometry-dependent keyframes. |
| Holds | `ANIM_HOLD` declares released `"false"` and four paused forms: `"true"`, `"park"`, `"park-under"`, and `"park-over"`. `ANIM_HOLD_PAUSED_VALUES` enumerates the paused forms. Held-arrival and image-hold markers identify content held until transition end. |
| Head gates | Governed, creep, and desktop-head markers gate root-level compiled opening rules. `PARK_HEAD_ATTR` is per screen: its declared purpose is to keep prerendered content on-screen through the head, granted only where the park-over hold has verified opaque cover. This source does not demonstrate that opacity verification at runtime. |
| Runtime and tooling | The GPU-prewarm marker identifies engine scratch content. `OFFLOADED_SRC_ATTR` retains an image's authored source while its src uses a replacement. `DEVTOOLS_PANEL_ATTR` reserves the devtools shadow host so engine scans can recognize it. |

The declarations explain why screen ownership must survive reparenting. They do not authorize structural queries to replace owner markers, nor prove that every declared reader currently handles every copy.

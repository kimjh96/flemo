# DOM attribute ownership protocol

`packages/core/src/dom/attributes.ts` declares public names used by bindings, compiled selectors, the engine, consumers, tests, and devtools. Renaming them is a breaking protocol change. Import constants for imperative operations; construct selectors with `attrSelector` or `attrValueSelector`. JSX names remain literal under the existing canonical validation rule. Each new attribute must identify its writer and readers. `FLEMO_ATTRIBUTES` enumerates declarations; it does not verify runtime use.

The module explicitly permits devtools to retain its own observed names without a runtime core dependency and describes a test comparing those names with the table. This assessment did not execute that test.

## Declared contracts

| Family | Contract |
| --- | --- |
| Screen identity | `SCREEN_ATTR` carries the screen ID while preserving presence-selector compatibility. Readers must not start requiring its value merely because IDs are available. `STATUS_ATTR`, `ACTIVE_ATTR`, and `TRANSITION_ATTR` select motion. Active means stack top, including the departing screen on pop. |
| Router and skip | `ROUTER_ATTR` identifies transition ownership independently of DOM ancestry. `SKIP_ANIMATION_ATTR` suppresses motion for a transition and is re-exported from engine types. |
| Shared bars | Bar markers carry status, active state, riding state, transition, ID, and ID type. The type distinguishes numeric `1` from string `"1"`. The spacer reserves bar height. |
| Decorators | `DECORATOR_ATTR` and `DECORATOR_NAME_ATTR` identify the dim and its definition. `DECORATOR_OWNER_ATTR` identifies every copy belonging to a screen, including portalled copies. Consumers needing all copies must use ownership, not assume one ref reaches them. |
| Layer host | `LAYER_HOST_ATTR` declares the host supplied by the outermost screen container and inherited by nested screens. Its documented layout is absolute and full-size; an empty host must not intercept pointers. |
| Layer slots | `LAYER_SLOT_ATTR` identifies a portalled slot. Its declared contract preserves screen stacking, status/active/transition, hidden state, and subtree lifetime. `LAYER_OWNER_ATTR` names its screen even in an ancestor's host. These declarations do not verify the unseen React implementation. |
| Parts | `PART_NAME_ATTR` names a registered transition. `PART_LAYER_ATTR` identifies the Router's staging layer. `PART_HOME_ATTR` records the source screen ID so lifted Parts remain discoverable for engine processing. `PART_STAND_IN_ATTR` marks the layout box left behind during staging. |
| Morph identity | `MORPH_ATTR` marks a registered element; runtime roles are `enter` and `exit`. `MORPH_NAME_ATTR` selects choreography; `MORPH_ID_ATTR` exposes the pairing key. |
| Morph staging | Morph layer, slot, stand-in, ghost, and shade markers identify staging, reserved layout, replacement paint, and shadow-carrier elements. The camera marker carries the transition ID for a screen-carrying morph. The sheet marker identifies runtime geometry-dependent keyframes. |
| Holds | `ANIM_HOLD` declares released `"false"` and four paused forms: `"true"`, `"park"`, `"park-under"`, and `"park-over"`. `ANIM_HOLD_PAUSED_VALUES` enumerates paused forms. Held-arrival and image-hold markers identify content held until transition end. |
| Head gates | Governed, creep, and desktop-head markers gate root-level compiled opening rules. Per-screen `PARK_HEAD_ATTR` is intended to keep prerendered content on-screen through the head, granted only where the park-over hold has verified opaque cover. This source does not demonstrate that opacity verification at runtime. |
| Runtime and tooling | The GPU-prewarm marker identifies engine scratch content. `OFFLOADED_SRC_ATTR` retains an image's authored source while its src uses a replacement. `DEVTOOLS_PANEL_ATTR` reserves the devtools shadow host so engine scans can recognize it. |

These declarations explain why screen ownership must survive reparenting. They neither authorize structural queries to replace owner markers nor prove that every declared reader handles every copy. Declarations and comments establish intended contracts, not implementation by unseen bindings or helpers or passing browser tests.

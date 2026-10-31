# Binding lifecycle

This describes the supplied `packages/core/src/core/engine/createTransitionEngine.ts` and `packages/core/src/core/engine/types.ts`. Executable branches establish engine behavior, not implementation of every contract by unseen bindings or helpers, nor passing browser tests.

## Binding inputs and disposal

Create an engine per screen. Inject `getTransitionTaskId(): string | null`, `setDragStatus`, and `setReplaceTransitionStatus`; both setters accept `"IDLE" | "PENDING"`.

Call `driveScreenLifecycle` from a layout-effect equivalent when its inputs change. Pass transition and previous-transition names, navigation status, active state, `animHoldReleased`, and a live `getElements` callback. Call its returned disposer before the next invocation and on teardown.

`getElements` returns the current nullable animated `scope`, optional decorator, optional bars permitting null or undefined entries, optional `screenContainer`, and optional `partLayer`. Resolve these live because refs can change after registration. The engine combines bars with `collectLayerRiders(screenContainer)`; a scope-local ref alone cannot reliably find a portalled overlay. The binding supplies its Router's part layer because it knows the screen bounds. The declared contract permits omission when the binding has no layer; staging is then skipped.

Pass `animHoldReleased: true` if the binding has no hold concept. The type's rAF-player comment is historical: the supplied engine drives compiled animation. `activeResumeEntryCount()` is internal leak-test bookkeeping, not a binding API to depend on.

## Per-pass cleanup

Each lifecycle pass replaces the sweep array. Its disposer captures that array, runs its sweeps, then runs the branch-specific disposer. Clearing an existing array in place would erase cleanup retained by an earlier pass.

Only the active side stamps unheld outer Parts during an unreleased transitional pass. A released or nontransitional active pass removes stamps found by `collectStampedOuterParts`. Independently, each disposer remembers its pass's exact stamped elements and removes their hold only while its value remains `"true"`. This identity-based sweep avoids recovering Router membership through a detached scope or broadly sweeping another Router's Parts.

Another sweep reads the live scope and calls `holds.abandon()` if it is absent or disconnected. If initially connected, it checks again in a microtask when that API exists, distinguishing ordinary effect reruns from detachment at commit end. The supplied engine shows the invocation; the implementation of `transitionHolds.abandon` was not supplied.

Staged shared-bar Parts persist across drive calls. Any nontransitional pass releases them before the active/passive branch, including a pop destination that has become active. Passive transitional passes request staging with the supplied part layer and a stranded timeout of `statusChoreographySpanMs(...) + 1500`.

Each engine has its own layer-owner symbol. Bar inline cleanup is owner-scoped because bars may be shared with swipe machinery. Active COMPLETED cleanup force-clears scope leases, explicitly strips `transform` and `opacity`, and clears skip markers on the scope, screen Parts, and decorator. Active resume budgets are keyed by task ID, removed on resolution, and pruned on stale teardown while surviving reruns of the same task.

## Completion and arrival landing

An accepted scope `animationend` must target the scope and match its expected transition name through `matchesTransitionAnimationName`. If `activeMotion` exists, zero-elapsed-time events are ignored. A clean accepted end detaches its listener and recovery before choreography and presentation deferrals.

The perceptual completion cut is separate from arrival landing. See [perceptual landing](../lifecycle/perceptual-landing.md) for the cut's exact eligibility and historical early-landing description. Current `scheduleLanding` invokes its callback two rAFs after scheduling, or immediately without rAF. `landNow` cancels and flushes a pending callback. No early arrival-landing timer remains in the supplied engine.

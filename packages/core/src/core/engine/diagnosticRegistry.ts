// The `flemo:*` diagnostic-flag registry: what each key IS, as data.
//
// This used to be an ASCII table in a comment above the readers, which drifted
// from the code four keys at a time (2026-08-17 → 08-19) while prose elsewhere
// pointed readers at it as the source of truth — and @flemo/devtools kept a
// hand-copied list that was missing five of the keys while still offering two
// dead ones.
//
// Data instead of prose, so both failures are checkable:
// - `__tests__/diagnosticRegistry.test.ts` fails if core reads a key this file
//   does not declare, or declares one nothing reads.
// - `__tests__/documentedDefaults.test.ts` asserts every computable default
//   against the reader that implements it.
// - devtools pins its own copy against `DIAGNOSTIC_FLAGS` (it stays
//   dependency-free at runtime; the check is a test-only import).
//
// This module holds NO readers, only the declarations — the completeness test
// scans every other core module for key literals, so a reader living here would
// be indistinguishable from its own declaration.

/**
 * What kind of thing a flag is — which decides how a report should read it.
 *
 * - `production-state`: written by the library itself (a learned ledger). Never
 *   set by hand; the KEY STRINGS are frozen, since users' devices carry
 *   persisted values.
 * - `production-default-with-override`: the library computes a default and the
 *   key overrides it both ways, for field debugging.
 * - `opt-in-diagnostic`: default OFF. A measurement instrument that ships so a
 *   device session can be probed without a custom build.
 */
export type DiagnosticFlagKind =
  "production-state" | "production-default-with-override" | "opt-in-diagnostic";

export interface DiagnosticFlag {
  readonly key: string;
  readonly storage: "session" | "local";
  readonly kind: DiagnosticFlagKind;
  /** Accepted values, for a report or a panel to offer. */
  readonly values: string;
  /** The default when the key is unset. */
  readonly fallback: string;
  readonly effect: string;
}

/** Every `flemo:*` key the library reads today. */
export const DIAGNOSTIC_FLAGS: readonly DiagnosticFlag[] = [
  {
    key: "flemo:sixty",
    storage: "session",
    kind: "production-state",
    values: '"high" / a streak count',
    fallback: "(learned)",
    effect: "steady-60 desktop verdict seed — owned by steadySixtyCadence.ts"
  },
  {
    key: "flemo:settle-gate",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "touch WebKit + touch Blink + desktop macOS WebKit + steady-60 desktop",
    effect: "render-settle entry gate, shared by the engine's routing and the binding"
  },
  {
    key: "flemo:arrivalhold",
    storage: "session",
    kind: "production-default-with-override",
    values: '"off"',
    fallback: "on",
    effect: "the whole in-flight hold set (arrival, response, invisible animations, images)"
  },
  {
    key: "flemo:deskflip",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "desktop macOS WebKit",
    effect: "atomic release flip: the hold attribute flips on the DOM inside the readiness rAF"
  },
  {
    key: "flemo:deskhead",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "desktop macOS WebKit",
    effect: "desktop flat-head keyframes; arming it retires the desktop birth anchor"
  },
  {
    key: "flemo:creep",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "touch WebKit",
    effect:
      "creep head: its end keyframe carries a hair of motion, so the compositor is already carrying the animation at the boundary"
  },
  {
    key: "flemo:relcommit",
    storage: "session",
    kind: "production-default-with-override",
    values: '"defer" / "sync"',
    fallback: "touch WebKit",
    effect: "the release's reconcile lands next frame instead of synchronously"
  },
  {
    key: "flemo:imgoffload",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "on — the offloader decides per image, from the source's own size",
    effect:
      "image decode offloader: an oversized source is fetched and downscaled in a worker so its decode never lands in a paint"
  },
  {
    key: "flemo:governed",
    storage: "session",
    kind: "production-default-with-override",
    values: '"on" / "off"',
    fallback: "legacy Android Blink (an old browser, not a slow device)",
    effect:
      "the governed head kit on touch Blink — a flat head covering a compiled flight's opening. The auto-detection reads browser AGE, so a modern-but-weak phone falls through it; this is how such a device gets measured"
  },
  {
    key: "flemo:imghold",
    storage: "session",
    kind: "opt-in-diagnostic",
    values: '"on" / "off"',
    fallback: "off",
    effect: "flight-scoped <img> reveal hold"
  },
  {
    key: "flemo:preraster",
    storage: "session",
    kind: "opt-in-diagnostic",
    values: '"on"',
    fallback: "off",
    effect:
      "REST-time scope promotion, and the park-over hold variant. Flight-time promotion is the engine's own stamp and needs no flag"
  },
  {
    key: "flemo:layers",
    storage: "session",
    kind: "opt-in-diagnostic",
    values: '"resident" / "off"',
    fallback: "off",
    effect:
      "keep screen layers resident at rest — a resident layer is a PERMANENT stacking context over the consumer's screen"
  },
  {
    key: "flemo:freeze",
    storage: "session",
    kind: "opt-in-diagnostic",
    values: '"shallow"',
    fallback: "off",
    effect: "keep the direct prev screen live instead of freezing it"
  }
];

export interface RetiredDiagnosticFlag {
  readonly key: string;
  readonly storage: "session" | "local";
  /** What it used to do, and when it stopped doing it. */
  readonly retiredWith: string;
}

/**
 * Keys the library once read and no longer does. Declared so a report can say
 * "this is set, and it does nothing" — residue that is merely unknown reads as
 * a lead worth chasing, and one such key once burned a multi-day investigation.
 *
 * Values persisted on users' devices are never read again.
 */
export const RETIRED_DIAGNOSTIC_FLAGS: readonly RetiredDiagnosticFlag[] = [
  {
    key: "flemo:motion-driver",
    storage: "local",
    retiredWith: "the per-origin driver demotion ledger (2026-08-19)"
  },
  {
    key: "flemo:motion-driver-force",
    storage: "session",
    retiredWith: "the hard driver pin, with the rAF player (2026-08-22)"
  },
  {
    key: "flemo:landing-snap",
    storage: "session",
    retiredWith: "the integer-device-pixel landing snap, falsified on device (2026-08-22)"
  },
  {
    key: "flemo:handoff",
    storage: "session",
    retiredWith: "the player's anchored-opening handoff (2026-08-22)"
  },
  {
    key: "flemo:handoffms",
    storage: "session",
    retiredWith: "the player's anchored-opening handoff (2026-08-22)"
  },
  {
    key: "flemo:apply",
    storage: "session",
    retiredWith: "the scrub-WAAPI value-application tier (2026-08-22)"
  },
  {
    key: "flemo:snap",
    storage: "session",
    retiredWith: "the player's device-pixel snap policy (2026-08-22)"
  },
  {
    key: "flemo:snapband",
    storage: "session",
    retiredWith: "the player's device-pixel snap policy (2026-08-22)"
  },
  {
    key: "flemo:lat",
    storage: "session",
    retiredWith: "the Low Power Mode release-latency probe (2026-08-22)"
  }
];

// Enumeration of the `flemo:*` diagnostic/override storage keys.
//
// The rows below are a VERBATIM copy of core's `DIAGNOSTIC_FLAGS` /
// `RETIRED_DIAGNOSTIC_FLAGS`, plus the two keys devtools owns itself.
// Duplicated ON PURPOSE: this package is a pure consumer with zero runtime
// dependencies — it observes pages whose flemo version it cannot assume, and a
// recorder that failed to load because core moved an export would be worse than
// one whose wording is a release behind.
//
// What is NOT left to good intentions is the copy staying a copy.
// `__tests__/overridesRegistry.test.ts` deep-compares every shared row against
// core's, field by field, through the test-only `@flemo/core` devDependency.
// The last hand-maintained version of this list was missing five live keys and
// still offering two dead ones, which is why the comparison exists.
//
// Why this module exists at all: residual override keys are invisible in a
// user's report ("it janks on my phone") and once burned a multi-day
// investigation — a stale `flemo:motion-driver-force` pin resurrected by
// mobile tab restoration reproduced a whole delay profile that no code path
// explained. Every report therefore leads with what is set.
//
// RETIRED keys get the same treatment for the opposite reason: the library no
// longer reads them, so finding one on a device must RULE IT OUT as a cause
// rather than leave an investigator chasing it.

export type FlagClass =
  "production-state" | "production-default-with-override" | "opt-in-diagnostic";

/**
 * The panel's drawer height. Declared HERE rather than in the panel so the
 * registry below can name it: a `flemo:` key the recorder writes but does not
 * declare shows up in its own reports as an unknown key.
 */
export const PANEL_HEIGHT_KEY = "flemo:devtools-panel-height";

export interface FlagDescriptor {
  key: string;
  storage: "session" | "local";
  kind: FlagClass;
  /** Accepted values, for a report to spell out. */
  values: string;
  /** The default when the key is unset. */
  fallback: string;
  /** What arming it changes. */
  effect: string;
}

/**
 * Keys DEVTOOLS itself owns. Core neither reads nor declares them, so they are
 * listed here and excluded from the comparison against core — without a row
 * each one would surface in every report as an unknown key, which is the
 * recorder generating its own false lead.
 */
export const DEVTOOLS_OWNED_FLAGS: readonly FlagDescriptor[] = [
  {
    key: "flemo:devtools",
    storage: "session",
    kind: "opt-in-diagnostic",
    values: '"on" / "off"',
    fallback: "off",
    effect: "arms this flight recorder in the playground (?devtools=on)"
  },
  {
    key: PANEL_HEIGHT_KEY,
    storage: "session",
    kind: "production-state",
    values: "a pixel height",
    fallback: "(the panel's default height)",
    effect: "the drawer height this panel was last dragged to"
  }
];

/** Every `flemo:*` key the library reads, mirrored from core. */
export const CORE_FLAGS: readonly FlagDescriptor[] = [
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
    fallback: "auto (legacy Android Blink)",
    effect: "image decode offloader override"
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

export const FLAG_REGISTRY: readonly FlagDescriptor[] = [...CORE_FLAGS, ...DEVTOOLS_OWNED_FLAGS];

/**
 * Keys the library once read and no longer does. They are still ENUMERATED so
 * a report can say "this is set, and it does nothing" — residue that is merely
 * unknown reads as a lead worth chasing.
 */
export interface RetiredFlag {
  key: string;
  storage: "session" | "local";
  /** What it used to do, and when it stopped doing it. */
  retiredWith: string;
}

export const RETIRED_FLAGS: readonly RetiredFlag[] = [
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

/** Marker suffix appended to a retired key so a report reads as a verdict. */
export const RETIRED_MARKER = "(retired — the library no longer reads this)";

type StorageLike = Pick<Storage, "getItem" | "key" | "length">;

const storageOrNull = (which: "session" | "local"): StorageLike | null => {
  try {
    const storage = which === "session" ? sessionStorage : localStorage;
    // Touch it so a partitioned/sandboxed document throws here, not later.
    void storage.length;
    return storage;
  } catch {
    return null;
  }
};

const readKey = (storage: StorageLike | null, key: string): string | null => {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
};

const registryKeys = new Set(FLAG_REGISTRY.map((flag) => flag.key));
const retiredKeys = new Set(RETIRED_FLAGS.map((flag) => flag.key));
const devtoolsOwnedKeys = new Set(DEVTOOLS_OWNED_FLAGS.map((flag) => flag.key));

/**
 * Snapshot every `flemo:*` key currently set, from both storages: the live
 * registry keys from their native storage, any RETIRED key still persisted
 * (marked as such), and any UNKNOWN `flemo:`-prefixed key either storage holds
 * (a future flag, or hand-set residue).
 */
export const snapshotOverrides = (): Record<string, string> => {
  const active: Record<string, string> = {};
  const session = storageOrNull("session");
  const local = storageOrNull("local");

  for (const flag of FLAG_REGISTRY) {
    const value = readKey(flag.storage === "session" ? session : local, flag.key);
    if (value !== null) active[flag.key] = value;
  }

  // A retired key is read from BOTH storages: several of them moved location
  // over their lifetime, and residue outlives the move.
  for (const flag of RETIRED_FLAGS) {
    for (const [storage, label] of [
      [session, "sessionStorage"],
      [local, "localStorage"]
    ] as const) {
      const value = readKey(storage, flag.key);
      if (value !== null) active[`${flag.key} (${label}) ${RETIRED_MARKER}`] = value;
    }
  }

  for (const [storage, label] of [
    [session, "sessionStorage"],
    [local, "localStorage"]
  ] as const) {
    if (!storage) continue;
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith("flemo:")) continue;
        if (registryKeys.has(key) || retiredKeys.has(key)) continue;
        active[`${key} (${label}, unknown key)`] = storage.getItem(key) ?? "";
      }
    } catch {
      // Storage enumeration unavailable: the registry reads above stand.
    }
  }

  return active;
};

/**
 * Derive prominent warnings from an override snapshot. Pure — testable with
 * a plain record and reusable on merged attach+report snapshots.
 */
export const deriveOverrideWarnings = (active: Record<string, string>): string[] => {
  const warnings: string[] = [];

  for (const [key, value] of Object.entries(active)) {
    if (key.includes(RETIRED_MARKER)) {
      // Match the EXACT base key, never a prefix: `flemo:motion-driver` is a
      // prefix of `flemo:motion-driver-force`, so a startsWith lookup silently
      // attributes the pin's residue to the demotion ledger's retirement note.
      const baseKey = key.slice(0, key.indexOf(" ("));
      const retired = RETIRED_FLAGS.find((entry) => entry.key === baseKey);
      warnings.push(
        `${key}=${value} — RETIRED residue: this key went with ${retired?.retiredWith ?? "a removed feature"}. ` +
          "The library never reads it, so it cannot explain anything you are seeing. Safe to delete; it is " +
          "listed only so it does not read as an unexplained lead."
      );
      continue;
    }
    const flag = FLAG_REGISTRY.find(
      (entry) => key === entry.key || key.startsWith(`${entry.key} `)
    );
    // The recorder's own keys are not findings about the page it is recording.
    if (!flag || devtoolsOwnedKeys.has(flag.key)) continue;
    if (flag.kind === "opt-in-diagnostic") {
      warnings.push(
        `${key}=${value} — opt-in diagnostic active (${flag.effect}); behavior differs from stock. ` +
          "Possible left-over A/B toggle from an earlier debugging session."
      );
    } else if (flag.kind === "production-default-with-override") {
      warnings.push(
        `${key}=${value} — production default overridden for this session (${flag.effect}). ` +
          `Stock behavior here is ${flag.fallback}.`
      );
    }
    // production-state keys (learned ledgers) are normal — no warning.
  }

  return warnings;
};

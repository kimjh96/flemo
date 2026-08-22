// Enumeration of the `flemo:*` diagnostic/override storage keys.
//
// The registry mirrors the flag table documented in
// packages/core/src/core/engine/diagnosticFlags.ts. Duplicated here ON
// PURPOSE: this package is a pure consumer with zero dependencies, and the
// keys are frozen strings — users' devices carry persisted values, so they
// cannot drift.
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

export interface FlagDescriptor {
  key: string;
  storage: "session" | "local";
  kind: FlagClass;
  description: string;
}

export const FLAG_REGISTRY: readonly FlagDescriptor[] = [
  {
    key: "flemo:sixty",
    storage: "session",
    kind: "production-state",
    description: "steady-60 display verdict seed ('high' latches, a count seeds the streak)"
  },
  {
    key: "flemo:imghold",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "flight-scoped <img> reveal hold"
  },
  {
    key: "flemo:arrivalhold",
    storage: "session",
    kind: "production-default-with-override",
    description: "in-flight arrival hold (default on; 'off' disarms the whole hold set)"
  },
  {
    key: "flemo:settle-gate",
    storage: "session",
    kind: "production-default-with-override",
    description: "render-settle entry gate override"
  },
  {
    key: "flemo:deskflip",
    storage: "session",
    kind: "production-default-with-override",
    description: "atomic release flip on desktop Safari (default on there)"
  },
  {
    key: "flemo:deskhead",
    storage: "session",
    kind: "production-default-with-override",
    description: "desktop flat-head keyframes (default on for desktop Safari)"
  },
  {
    key: "flemo:creep",
    storage: "session",
    kind: "production-default-with-override",
    description: "creep head on touch WebKit (default on there)"
  },
  {
    key: "flemo:relcommit",
    storage: "session",
    kind: "production-default-with-override",
    description: "release reconcile deferred to the next frame (default on touch WebKit)"
  },
  {
    key: "flemo:layers",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "resident screen layers at rest"
  },
  {
    key: "flemo:freeze",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "keep the direct prev screen live"
  },
  {
    key: "flemo:preraster",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "promote the entering content layer through the hold"
  },
  {
    key: "flemo:imgoffload",
    storage: "session",
    kind: "production-default-with-override",
    description: "image decode offloader override"
  },
  {
    key: "flemo:devtools",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "arms this flight recorder in the playground (?devtools=on)"
  }
];

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
    retiredWith: "the per-origin driver demotion ledger (removed 2026-08-19)"
  },
  {
    key: "flemo:motion-driver-force",
    storage: "session",
    retiredWith: "the hard driver pin (removed with the rAF player, 2026-08-22)"
  },
  {
    key: "flemo:landing-snap",
    storage: "session",
    retiredWith: "the integer-device-pixel landing snap A/B (falsified on device, 2026-08-22)"
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
    if (!flag || flag.key === "flemo:devtools") continue;
    if (flag.kind === "opt-in-diagnostic") {
      warnings.push(
        `${key}=${value} — opt-in diagnostic active (${flag.description}); behavior differs from stock. ` +
          "Possible left-over A/B toggle from an earlier debugging session."
      );
    } else if (flag.kind === "production-default-with-override") {
      warnings.push(
        `${key}=${value} — production default overridden for this session (${flag.description}).`
      );
    }
    // production-state keys (learned ledgers) are normal — no warning.
  }

  return warnings;
};

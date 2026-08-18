// Enumeration of the `flemo:*` diagnostic/override storage keys.
//
// The registry mirrors the flag table documented in
// packages/core/src/core/engine/diagnosticFlags.ts (plus the two driver keys
// owned by driverPolicy.ts). Duplicated here ON PURPOSE: this package is a
// pure consumer with zero dependencies, and the keys are frozen strings —
// users' devices carry persisted values, so they cannot drift.
//
// Why this module exists at all: residual override keys are invisible in a
// user's report ("it janks on my phone") and once burned a multi-day
// investigation — a stale `flemo:motion-driver-force` pin resurrected by
// mobile tab restoration reproduced a whole delay profile that no code path
// explained. Every report therefore leads with what is set.

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
    key: "flemo:motion-driver",
    storage: "local",
    kind: "production-state",
    description:
      "learned driver ledger ('css' = player demoted on this device, 'raf' = clean probe)"
  },
  {
    key: "flemo:motion-driver-force",
    storage: "session",
    kind: "opt-in-diagnostic",
    description:
      "hard driver pin ('css@<epoch-ms>' / 'raf@<epoch-ms>', 24h TTL) — pins EVERY transition"
  },
  {
    key: "flemo:lpm",
    storage: "session",
    kind: "production-state",
    description: "low-power-mode cadence seed (learned)"
  },
  {
    key: "flemo:lat",
    storage: "session",
    kind: "production-state",
    description: "LPM release-latency seed (learned)"
  },
  {
    key: "flemo:landing-snap",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "Blink landing pixel-snap easing A/B"
  },
  {
    key: "flemo:imghold",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "flight-scoped <img> reveal hold"
  },
  {
    key: "flemo:settle-gate",
    storage: "session",
    kind: "production-default-with-override",
    description: "render-settle entry gate override"
  },
  {
    key: "flemo:handoff",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "anchored-opening handoff (POP-scoped)"
  },
  {
    key: "flemo:handoffms",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "handoff point override (ms)"
  },
  {
    key: "flemo:apply",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "force the scrub-WAAPI value-application tier"
  },
  {
    key: "flemo:snap",
    storage: "session",
    kind: "production-default-with-override",
    description: "player device-pixel snap policy override"
  },
  {
    key: "flemo:snapband",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "'hybrid' snap jitter-band width (device px)"
  },
  {
    key: "flemo:layers",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "resident screen layers at rest (armed by ?flemo-layers=)"
  },
  {
    key: "flemo:freeze",
    storage: "session",
    kind: "opt-in-diagnostic",
    description: "keep the direct prev screen live (armed by ?flemo-freeze=)"
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

const FORCE_PIN_KEY = "flemo:motion-driver-force";
/** Marker suffix for the legacy-location residue of the force pin. */
export const LEGACY_LOCAL_PIN_KEY = `${FORCE_PIN_KEY} (localStorage — legacy location)`;

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

/**
 * Snapshot every `flemo:*` key currently set, from both storages: the
 * registry keys from their native storage, the legacy localStorage location
 * of the force pin, and any UNKNOWN `flemo:`-prefixed key either storage
 * holds (a future flag, or hand-set residue).
 */
export const snapshotOverrides = (): Record<string, string> => {
  const active: Record<string, string> = {};
  const session = storageOrNull("session");
  const local = storageOrNull("local");

  for (const flag of FLAG_REGISTRY) {
    const value = readKey(flag.storage === "session" ? session : local, flag.key);
    if (value !== null) active[flag.key] = value;
  }

  const legacyPin = readKey(local, FORCE_PIN_KEY);
  if (legacyPin !== null) active[LEGACY_LOCAL_PIN_KEY] = legacyPin;

  for (const [storage, label] of [
    [session, "sessionStorage"],
    [local, "localStorage"]
  ] as const) {
    if (!storage) continue;
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key || !key.startsWith("flemo:") || registryKeys.has(key)) continue;
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
    if (key === FORCE_PIN_KEY) {
      warnings.push(
        `${key}=${value} — A DRIVER PIN IS ACTIVE: every transition this session is forced onto one driver, ` +
          "bypassing measurement and demotion. If you did not set it deliberately just now, it is A/B residue " +
          "(mobile tab restoration resurrects sessionStorage across days; pins expire after 24h). This exact " +
          "residue once burned a multi-day investigation — clear the key before judging any behavior."
      );
      continue;
    }
    if (key === LEGACY_LOCAL_PIN_KEY) {
      warnings.push(
        `${key}=${value} — legacy localStorage driver pin present. The library removes it on sight and never ` +
          "honors it, but its existence means an old A/B session left residue on this profile."
      );
      continue;
    }
    if (key.startsWith(`${FORCE_PIN_KEY} `)) {
      // A marked variant (e.g. "(at attach, since cleared)") added by the
      // recorder's snapshot merge — still worth the loud pin warning.
      warnings.push(
        `${key}=${value} — a driver force pin was observed this session (see marker in the key). Even a ` +
          "since-cleared pin may have shaped early driver decisions; treat this session's routing as suspect."
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
    // production-state keys (learned ledgers) are normal — no warning; the
    // driver ledger surfaces separately under report.driverPolicy.
  }

  return warnings;
};

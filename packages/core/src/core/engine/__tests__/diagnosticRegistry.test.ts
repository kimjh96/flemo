import { describe, expect, it } from "vitest";

import { DIAGNOSTIC_FLAGS, RETIRED_DIAGNOSTIC_FLAGS } from "@core/engine/diagnosticRegistry";

// The flag registry, held to the readers.
//
// The registry used to be an ASCII table in a comment. It rotted the way every
// unchecked table rots: five keys were added to the engine without a row, two
// rows outlived the code they described, and @flemo/devtools — which had
// hand-copied the table — offered a panel that could toggle neither the missing
// five nor anything real for the dead two. Nobody noticed until a report came
// back listing overrides that no longer existed.
//
// So the registry is data, and it is pinned in BOTH directions:
//
//   1. Every `"flemo:…"` key literal in core's source is declared here — live
//      or retired. Adding a reader without a row fails this suite.
//   2. Every declared live key is actually read by some module. Deleting a
//      reader without deleting its row fails this suite too, which is the half
//      the old table never had and the half that produced the dead rows.
//
// Direction 2 is why the declarations live in their own module: a reader that
// sat beside them would be indistinguishable from its own declaration, and the
// check would pass on a registry that reads nothing at all.

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { query: string; import: string; eager: true }
    ): Record<string, string>;
  }
}

/**
 * Every core module EXCEPT the declarations themselves and the tests. What is
 * left is exactly the read sites.
 */
const SOURCES = import.meta.glob("../../../**/*.ts", {
  query: "?raw",
  import: "default",
  eager: true
});

/** A double-quoted `flemo:` key literal — a real read, never a comment mention. */
const KEY_LITERAL = /"(flemo:[a-z0-9:-]+)"/g;

const readSites = (): Map<string, string[]> => {
  const sites = new Map<string, string[]>();
  for (const [path, source] of Object.entries(SOURCES)) {
    // Tests are excluded BY FILENAME, not by directory: the glob is relative
    // to this file, so a sibling suite comes back as `./foo.test.ts` with no
    // `__tests__` in the path at all. Counting one as a read site is how a key
    // that only a test still sets would read as live — which is exactly what
    // this suite found on its first run.
    if (path.includes("__tests__") || path.endsWith(".test.ts")) continue;
    if (path.endsWith("diagnosticRegistry.ts")) continue;
    for (const match of source.matchAll(KEY_LITERAL)) {
      const key = match[1];
      sites.set(key, [...(sites.get(key) ?? []), path]);
    }
  }
  return sites;
};

const liveKeys = new Set(DIAGNOSTIC_FLAGS.map((flag) => flag.key));
const retiredKeys = new Set(RETIRED_DIAGNOSTIC_FLAGS.map((flag) => flag.key));

describe("the diagnostic-flag registry", () => {
  it("scans a source set that actually contains the readers", () => {
    // The guard's own guard: a glob that silently stopped matching would make
    // every check below vacuously true, which is precisely how the original
    // table died unnoticed.
    expect(Object.keys(SOURCES).length).toBeGreaterThan(20);
    expect(readSites().size).toBeGreaterThan(5);
  });

  it("declares every key core reads", () => {
    for (const [key, paths] of readSites()) {
      expect(liveKeys.has(key) || retiredKeys.has(key), `${key} read in ${paths.join(", ")}`).toBe(
        true
      );
    }
  });

  it("declares no live key that nothing reads", () => {
    const sites = readSites();
    for (const flag of DIAGNOSTIC_FLAGS) {
      expect(sites.has(flag.key), `${flag.key} is declared but never read`).toBe(true);
    }
  });

  it("keeps retired keys retired — a read would make one live again", () => {
    const sites = readSites();
    for (const flag of RETIRED_DIAGNOSTIC_FLAGS) {
      expect(sites.has(flag.key), `${flag.key} is retired but still read`).toBe(false);
    }
  });

  it("never lists a key as both live and retired", () => {
    for (const key of retiredKeys) expect(liveKeys.has(key)).toBe(false);
  });

  it("describes every entry well enough for a report to be read by a human", () => {
    for (const flag of DIAGNOSTIC_FLAGS) {
      expect(flag.key.startsWith("flemo:"), flag.key).toBe(true);
      expect(flag.effect.length, flag.key).toBeGreaterThan(20);
      expect(flag.values.length, flag.key).toBeGreaterThan(0);
      expect(flag.fallback.length, flag.key).toBeGreaterThan(0);
    }
    for (const flag of RETIRED_DIAGNOSTIC_FLAGS) {
      // A retirement note has to say what the key went WITH: a bare "removed"
      // leaves an investigator with the same unexplained lead the entry exists
      // to close.
      expect(flag.retiredWith.length, flag.key).toBeGreaterThan(20);
      expect(flag.retiredWith, flag.key).toMatch(/20\d\d-\d\d-\d\d/);
    }
  });

  it("holds every computable default to an assertion in documentedDefaults", () => {
    // A row nothing asserts is a row free to drift again — which is how the
    // table rotted the first time. production-state keys are LEDGERS the
    // library writes for itself, with no default to document, so they are
    // exempt: `flemo:sixty` has its own suite for the verdict it seeds.
    const suite = Object.entries(SOURCES).find(([path]) =>
      path.endsWith("documentedDefaults.test.ts")
    )?.[1];
    expect(suite, "documentedDefaults.test.ts is not in the scanned set").toBeTruthy();

    const owed = DIAGNOSTIC_FLAGS.filter((flag) => flag.kind !== "production-state");
    expect(owed.length).toBeGreaterThan(5);
    for (const flag of owed) {
      expect(suite?.includes(`"${flag.key}"`), `${flag.key} has no documented-default test`).toBe(
        true
      );
    }
  });

  it("has unique keys", () => {
    const all = [...DIAGNOSTIC_FLAGS, ...RETIRED_DIAGNOSTIC_FLAGS].map((flag) => flag.key);
    expect(new Set(all).size).toBe(all.length);
  });
});

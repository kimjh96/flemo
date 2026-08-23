import { describe, expect, it } from "vitest";

// The architecture doc, held to the code.
//
// `packages/core/docs/motion-engine.md` spent a release cycle untracked. Nobody
// reviewed it, no check read it, and by the time anyone looked it described two
// modules that had been deleted and a motion driver that no longer existed —
// while the code it claimed to map was correct throughout. An untracked
// document does not stay honest; it rots silently and then misleads.
//
// So the doc is tracked, and its module inventory is pinned here in both
// directions: every module it names must exist, and every module in the mapped
// directories must be named. Adding a module without a line in the table fails
// this suite, which is the only way a map like this survives contact with a
// year of changes.
//
// What is NOT checked is the prose. A test cannot tell whether a paragraph
// still describes what the code does — that stays the author's job, and the
// inventory check exists precisely because the mechanical half is the half that
// rots first.

declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { query: string; import: string; eager: true }
    ): Record<string, string>;
  }
}

const DOC = import.meta.glob("../../../../docs/motion-engine.md", {
  query: "?raw",
  import: "default",
  eager: true
});

/** Source modules the doc's inventory is expected to cover, by directory. */
const MAPPED = import.meta.glob("../../../{core/engine,platform,dom}/*.ts", {
  query: "?raw",
  import: "default",
  eager: true
});

const doc = Object.values(DOC)[0] ?? "";

/** Basenames the inventory tables name, e.g. `flightRouting.ts`. */
const namedInDoc = new Set(
  [...doc.matchAll(/`([A-Za-z][A-Za-z0-9]*\.ts)`/g)].map((match) => match[1]!)
);

const moduleBasenames = Object.keys(MAPPED)
  .map((path) => path.split("/").pop()!)
  .filter((name) => !name.endsWith(".test.ts"));

describe("packages/core/docs/motion-engine.md", () => {
  it("is tracked and reachable from the test suite", () => {
    expect(doc.length).toBeGreaterThan(0);
    expect(doc).toContain("# The flemo motion engine");
  });

  it("names every module under core/engine, platform and dom", () => {
    const missing = moduleBasenames.filter((name) => !namedInDoc.has(name)).sort();
    expect(missing).toEqual([]);
  });

  it("names no module that does not exist", () => {
    // Only judge names that LOOK like modules of the mapped directories: the
    // doc legitimately cites files elsewhere in the tree (the compiler, the
    // lease model, the binding), and those live outside this glob.
    const known = new Set(moduleBasenames);
    const cited = [...doc.matchAll(/`(?:[\w[\]./-]*\/)?([A-Za-z][A-Za-z0-9]*\.ts)`/g)].map(
      (match) => match[1]!
    );
    const elsewhere = new Set([
      // Deliberately outside the mapped directories — the doc's last table.
      "animStartAnchor.ts",
      "pendingNetwork.ts",
      "variantMotion.ts",
      "animateInline.ts",
      "compileTransitionStyles.ts",
      "enteringInitialStyle.ts",
      "documentedDefaults.test.ts",
      "architectureDoc.test.ts"
    ]);
    const ghosts = [...new Set(cited)]
      .filter((name) => !known.has(name) && !elsewhere.has(name))
      .sort();
    expect(ghosts).toEqual([]);
  });

  it("cites no document that is not tracked beside it", () => {
    // Source comments once pointed at three `docs/*` files that existed in
    // nobody's checkout. A citation the reader cannot follow is worse than no
    // citation: it reads as a promise the repository does not keep.
    const cited = [...doc.matchAll(/\]\(([^)]+\.md)\)/g)].map((match) => match[1]!);
    const unresolvable = cited.filter((href) => !href.startsWith("./"));
    expect(unresolvable).toEqual([]);
  });
});

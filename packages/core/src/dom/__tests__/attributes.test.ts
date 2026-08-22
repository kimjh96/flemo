import { describe, expect, it } from "vitest";

import {
  ANIM_HOLD,
  ANIM_HOLD_ATTR,
  ANIM_HOLD_PAUSED_VALUES,
  attrSelector,
  attrValueSelector,
  FLEMO_ATTR_PREFIX,
  FLEMO_ATTRIBUTES
} from "@dom/attributes";

// The protocol module exists to make the `data-flemo-*` contract a THING
// rather than a habit. These suites are what keep it one: the table has to stay
// complete, and no source file may reintroduce a raw literal — which is how the
// contract silently drifted before.
//
// The source sweep reads every core module through Vite's raw glob rather than
// the filesystem: this package targets the browser and carries no Node types,
// and the check should not be the reason it starts to. `import.meta.glob` is a
// Vite transform rather than a standard member, and pulling in `vite/client`
// would put bundler types into a library's typecheck — so it is declared here,
// where it is used, and nowhere else.
declare global {
  interface ImportMeta {
    glob(
      pattern: string,
      options: { query: string; import: string; eager: true }
    ): Record<string, string>;
  }
}

const SOURCES = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true
});

const sourceEntries = (): [string, string][] =>
  Object.entries(SOURCES).filter(([path]) => !path.includes("__tests__"));

describe("the attribute table", () => {
  it("names every attribute with the shared prefix, and lists each exactly once", () => {
    for (const attribute of FLEMO_ATTRIBUTES) {
      expect(attribute.startsWith(FLEMO_ATTR_PREFIX)).toBe(true);
    }
    expect(new Set(FLEMO_ATTRIBUTES).size).toBe(FLEMO_ATTRIBUTES.length);
  });

  it("covers every data-flemo-* name that appears anywhere in core's source", () => {
    // The point of the module: an attribute the code writes but the table does
    // not know about is exactly the orphan this ends. Comments count too — a
    // name documented but never tabled is a name nobody can find the writer of.
    const declared = new Set<string>(FLEMO_ATTRIBUTES);
    const found = new Set<string>();
    for (const [, source] of sourceEntries()) {
      for (const match of source.matchAll(/data-flemo-[a-z-]+/g)) {
        // Trailing hyphens come from prose like "`data-flemo-*` markers".
        found.add(match[0].replace(/-+$/, ""));
      }
    }
    expect([...found].filter((name) => !declared.has(name)).sort()).toEqual([]);
  });

  it("is the ONLY place a data-flemo-* literal is written", () => {
    // A raw literal anywhere else is the drift this module exists to end: it
    // type-checks, it passes every other test, and it silently stops matching
    // the moment the real name changes. Comments are allowed to spell names out
    // — code is not.
    const offenders: string[] = [];
    for (const [path, source] of sourceEntries()) {
      if (path.endsWith("attributes.ts")) continue; // the table itself
      source.split("\n").forEach((line: string, index: number) => {
        const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
        if (!/data-flemo-[a-z-]+/.test(code)) return;
        offenders.push(`${path}:${index + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("the animation hold's values", () => {
  it("pauses on every held form and on nothing else", () => {
    expect([...ANIM_HOLD_PAUSED_VALUES].sort()).toEqual(
      [ANIM_HOLD.HELD, ANIM_HOLD.PARK, ANIM_HOLD.PARK_UNDER, ANIM_HOLD.PARK_OVER].sort()
    );
    expect(ANIM_HOLD_PAUSED_VALUES).not.toContain(ANIM_HOLD.RELEASED);
  });

  it("keeps the release value distinct from every held form", () => {
    expect(new Set(Object.values(ANIM_HOLD)).size).toBe(Object.values(ANIM_HOLD).length);
  });
});

describe("selector helpers", () => {
  it("build presence and value selectors", () => {
    expect(attrSelector(ANIM_HOLD_ATTR)).toBe("[data-flemo-anim-hold]");
    expect(attrValueSelector(ANIM_HOLD_ATTR, ANIM_HOLD.PARK)).toBe('[data-flemo-anim-hold="park"]');
  });
});

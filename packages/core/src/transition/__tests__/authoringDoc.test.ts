/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import createTransition from "@transition/createTransition";
import cupertino from "@transition/cupertino";

import type { TransitionVariant } from "@transition/typing";

import createDecorator from "@transition/decorator/createDecorator";
import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import createPartTransition from "@transition/partTransition/createPartTransition";

// THE ONE DOCUMENT AGENTS.md CALLS REQUIRED READING, CHECKED AGAINST THE CODE.
//
// `docs/instructions/transition-authoring.md` exists because the four factories
// share a vocabulary and do not share its meaning, and getting a pose into the
// wrong slot is the mistake that costs a day. A table that says which slot each
// side lands in is only worth reading while it is TRUE, and prose has no way of
// staying true on its own: this repository shipped three comments asserting a
// part does not inherit its screen's clock for six days after it started
// inheriting it, and nothing failed.
//
// So the table is not prose here. It is parsed and compared against what the
// factories actually build, which makes a wrong row a failing test rather than
// a reader's lost afternoon.
const DOC = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../docs/instructions/transition-authoring.md"
);

// Each slot is authored as its own name, so the variant table can be read back
// as "which slot landed here" without a mapping.
const slot = (name: string) => ({ value: { x: name }, options: { duration: 0 } });

const screen = createTransition({
  name: "doc-screen" as never,
  initial: {},
  idle: slot("idle"),
  enter: slot("enter"),
  enterBack: slot("enterBack"),
  exit: slot("exit"),
  exitBack: slot("exitBack")
});

const morph = createMorphTransition({
  name: "doc-morph",
  initial: {},
  idle: slot("idle"),
  enter: slot("enter"),
  exit: slot("exit")
});

const part = createPartTransition({
  name: "doc-part",
  initial: {},
  idle: slot("idle"),
  enter: slot("enter"),
  exit: slot("exit"),
  dismiss: slot("dismiss")
});

const decorator = createDecorator({
  name: "doc-decorator" as never,
  initial: {},
  idle: slot("idle"),
  enter: slot("enter"),
  exit: slot("exit")
});

const BUILT = { screen, morph, part, decorator } as const;

// The first backticked token in a cell. "`dismiss`, else `idle`" is the slot
// that wins when the author gave one, which is how these are built above.
const claimed = (cell: string): string => {
  const match = /`([A-Za-z]+)`/.exec(cell);
  if (!match) throw new Error(`no slot named in cell: ${cell}`);
  return match[1];
};

interface Row {
  variant: TransitionVariant;
  slots: Record<keyof typeof BUILT, string>;
}

const readRows = (): Row[] => {
  const doc = readFileSync(DOC, "utf8");
  const section = doc.split("## 2.")[1]?.split("## 3.")[0];
  if (!section) throw new Error("section 2 is gone from the authoring doc");

  const rows: Row[] = [];
  for (const line of section.split("\n")) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 7) continue;
    if (!/^(PUSHING|REPLACING|POPPING|COMPLETED)$/.test(cells[0])) continue;
    rows.push({
      variant: `${cells[0]}-${cells[1]}` as TransitionVariant,
      slots: {
        screen: claimed(cells[3]),
        morph: claimed(cells[4]),
        part: claimed(cells[5]),
        decorator: claimed(cells[6])
      }
    });
  }
  return rows;
};

describe("the transition authoring document", () => {
  const rows = readRows();

  it("names a row for every side of every flight", () => {
    const covered = new Set(rows.map((row) => row.variant));
    for (const status of ["PUSHING", "REPLACING", "POPPING"]) {
      expect(covered).toContain(`${status}-true`);
      expect(covered).toContain(`${status}-false`);
    }
  });

  it.each(rows)("puts $variant in the slot the factories put it in", ({ variant, slots }) => {
    for (const [kind, built] of Object.entries(BUILT)) {
      const landed = built.variants[variant].value.x;
      expect(`${kind} ${variant}: ${String(landed)}`).toBe(
        `${kind} ${variant}: ${slots[kind as keyof typeof BUILT]}`
      );
    }
  });

  it("is right about the one slot a part has and a decorator does not", () => {
    const doc = readFileSync(DOC, "utf8");
    expect(doc).toContain("omitting it holds `idle`");
    const bare = createPartTransition({
      name: "doc-part-bare",
      initial: {},
      idle: slot("idle"),
      enter: slot("enter"),
      exit: slot("exit")
    });
    expect(bare.variants["POPPING-true"].value.x).toBe("idle");
    expect(decorator.variants["POPPING-true"].value.x).toBe("idle");
  });

  it("quotes cupertino's enterBack correctly", () => {
    // The doc calls this out because it is the row read wrong most often: on a
    // pop the ACTIVE screen is the one leaving.
    const doc = readFileSync(DOC, "utf8");
    expect(doc).toContain('In `cupertino` it is `x: "100%"`');
    expect(cupertino.variants["POPPING-true"].value.x).toBe("100%");
  });
});

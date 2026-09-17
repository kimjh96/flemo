/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import createRawTransition from "@transition/createRawTransition";

import createTransition from "@transition/createTransition";
import cupertino from "@transition/cupertino";
import { transitionMap } from "@transition/transition";

import type { TransitionVariant } from "@transition/typing";

import createDecorator from "@transition/decorator/createDecorator";
import createRawDecorator from "@transition/decorator/createRawDecorator";
import { decoratorMap } from "@transition/decorator/decorator";
import createMorphTransition from "@transition/morphTransition/createMorphTransition";
import createRawMorphTransition from "@transition/morphTransition/createRawMorphTransition";
import { morphTransitionMap } from "@transition/morphTransition/morphTransition";
import createPartTransition from "@transition/partTransition/createPartTransition";
import createRawPartTransition from "@transition/partTransition/createRawPartTransition";

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
  "../../../../../docs/instructions/transition-authoring/semantics.md"
);

// The heading the slot table lives under. Named rather than counted: the
// document was split into one file per concern and every "## 2." this test used
// to find went with it, which broke the check silently in the split's own
// commit.
const SLOT_TABLE = "## Who is who on every status";

const TRANSITION_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const FACTORY_INPUTS = [
  {
    file: "createTransition.ts",
    properties: ["name", "initial", "idle", "enter", "enterBack", "exit", "exitBack", "options"]
  },
  {
    file: "createRawTransition.ts",
    properties: [
      "name",
      "initial",
      "idle",
      "pushOnEnter",
      "pushOnExit",
      "replaceOnEnter",
      "replaceOnExit",
      "popOnEnter",
      "popOnExit",
      "completedOnEnter",
      "completedOnExit",
      "options"
    ]
  },
  {
    file: "partTransition/createPartTransition.ts",
    properties: ["name", "initial", "idle", "enter", "exit", "dismiss", "options"]
  },
  {
    file: "partTransition/createRawPartTransition.ts",
    properties: [
      "name",
      "initial",
      "idle",
      "pushOnEnter",
      "pushOnExit",
      "replaceOnEnter",
      "replaceOnExit",
      "popOnEnter",
      "popOnExit",
      "completedOnEnter",
      "completedOnExit",
      "options"
    ]
  },
  {
    file: "morphTransition/createMorphTransition.ts",
    properties: ["name", "initial", "idle", "enter", "exit", "options"]
  },
  {
    file: "morphTransition/createRawMorphTransition.ts",
    properties: [
      "name",
      "initial",
      "idle",
      "pushOnEnter",
      "pushOnExit",
      "replaceOnEnter",
      "replaceOnExit",
      "popOnEnter",
      "popOnExit",
      "options"
    ]
  },
  {
    file: "decorator/createDecorator.ts",
    properties: ["name", "initial", "idle", "enter", "exit", "options"]
  },
  {
    file: "decorator/createRawDecorator.ts",
    properties: [
      "name",
      "initial",
      "idle",
      "pushOnEnter",
      "pushOnExit",
      "replaceOnEnter",
      "replaceOnExit",
      "popOnEnter",
      "popOnExit",
      "completedOnEnter",
      "completedOnExit",
      "options"
    ]
  }
] as const;

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
  const section = doc.split(SLOT_TABLE)[1]?.split("\n## ")[0];
  if (!section) throw new Error(`${SLOT_TABLE} is gone from the authoring doc`);

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
    expect(doc).toContain("omission holds `idle`");
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
    expect(doc).toContain('In `cupertino`, it is `x: "100%"`');
    expect(cupertino.variants["POPPING-true"].value.x).toBe("100%");
  });
});

describe("published transition factory guidance", () => {
  it.each(FACTORY_INPUTS)("keeps every $file input documented in declaration output", (factory) => {
    const source = readFileSync(resolve(TRANSITION_DIR, factory.file), "utf8");
    const emitted = ts.transpileDeclaration(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext
      },
      fileName: factory.file,
      reportDiagnostics: true
    });

    expect(emitted.diagnostics ?? []).toEqual([]);
    expect(emitted.outputText).toMatch(/\/\*\*[\s\S]*?\*\/\s+export default function create/);

    for (const property of factory.properties) {
      const documentedProperty = new RegExp(
        String.raw`\/\*\*(?:(?!\/\*\*)[\s\S])*?\*\/\s+${property}\??:`
      );
      expect(emitted.outputText, `${factory.file}: ${property}`).toMatch(documentedProperty);
    }
  });

  // Found by an agent that had only the published tarball to read: the attribute
  // every consumer inspects in devtools was glossed as "the screen the
  // navigation is moving TO", which is true on a push and backwards on a pop.
  // It is the single misreading this codebase warns about most, and it shipped.
  it("does not gloss the active attribute as the arriving screen", () => {
    const source = readFileSync(resolve(TRANSITION_DIR, "../dom/attributes.ts"), "utf8");
    const emitted = ts.transpileDeclaration(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext
      },
      fileName: "dom/attributes.ts"
    }).outputText;

    const activeDoc =
      /\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s+(?:export )?declare const ACTIVE_ATTR/.exec(emitted);
    expect(activeDoc, "ACTIVE_ATTR lost its documentation").not.toBeNull();
    expect(activeDoc![1]).toContain("not which one is arriving");
    expect(activeDoc![1]).toContain("on a pop the");
    expect(activeDoc![1]).not.toMatch(/moving TO/);
  });

  it("states that Part swipe hooks replace, rather than enable, gesture riding", () => {
    const source = readFileSync(resolve(TRANSITION_DIR, "partTransition/typing.ts"), "utf8");
    const emitted = ts.transpileDeclaration(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext
      },
      fileName: "partTransition/typing.ts"
    }).outputText;

    expect(emitted).toContain("already follows the transition's swipe");
    expect(emitted).toContain("opts that Part element out of the default rider");
  });
});

// THE RAW FACTORIES DOCUMENT THEIR OWN MAPPING, SO THE MAPPING IS CHECKED.
//
// A raw factory's whole job is that the author names the variant directly, and
// its declaration now says which one each slot lands in. That is a claim about
// the very next twelve lines of the same file, which makes it exactly the kind
// of sentence that survives a refactor it stopped describing.
//
// It also pins one asymmetry worth keeping honest: `popOnEnter` is POPPING-true
// for a screen, a part and a decorator, and POPPING-false for a MORPH, because
// a morph's entering side is the element that flies and on a pop that element
// is the inactive one. A normalizing refactor would "fix" that and pair every
// morph backwards on every pop.
const RAW_FACTORIES = [
  { file: "createRawTransition.ts", build: createRawTransition },
  { file: "partTransition/createRawPartTransition.ts", build: createRawPartTransition },
  { file: "decorator/createRawDecorator.ts", build: createRawDecorator },
  { file: "morphTransition/createRawMorphTransition.ts", build: createRawMorphTransition }
] as const;

/** Every `/** ... \`VARIANT\` ... *\/ propName:` pair a factory's input declares. */
const documentedVariants = (file: string): { property: string; variant: TransitionVariant }[] => {
  const source = readFileSync(resolve(TRANSITION_DIR, file), "utf8");
  const claims: { property: string; variant: TransitionVariant }[] = [];
  const pattern = /\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s+([A-Za-z]+)\??:/g;
  for (const [, doc, property] of source.matchAll(pattern)) {
    const named = /`((?:PUSHING|REPLACING|POPPING|COMPLETED|IDLE)-(?:true|false))`/.exec(doc);
    if (named) claims.push({ property, variant: named[1] as TransitionVariant });
  }
  return claims;
};

describe("a raw factory's documented variant", () => {
  it.each(RAW_FACTORIES)("is the variant $file actually fills", ({ file, build }) => {
    const claims = documentedVariants(file);
    expect(claims.length, `${file} documents no variant at all`).toBeGreaterThan(5);

    const input: Record<string, unknown> = { name: `doc-raw-${file}`, initial: {} };
    for (const { property } of claims) input[property] = slot(property);
    input.idle = slot("idle");

    const built = (
      build as (props: never) => { variants: Record<string, { value: { x: string } }> }
    )(input as never);

    for (const { property, variant } of claims) {
      expect(`${file} ${variant}: ${built.variants[variant].value.x}`).toBe(
        `${file} ${variant}: ${property}`
      );
    }
  });
});

// A PRESET IS CHOSEN BY NAME, SO ITS NAME IS WHAT ITS DOCUMENTATION MUST CARRY.
//
// These eight are pre-registered: nothing is passed to <Router> to use them,
// which is precisely why a consumer cannot discover them by reading their own
// code. The export name and the registered name also differ for two of them
// (`textMorph` is `"text"`, `zoomMorph` is `"zoom"`), so the declaration has to
// say which string a <Morph name> takes.
// One shape for three differently-keyed registries: each map narrows its key to
// its own name union, and mixing them in one table narrows the shared getter to
// `never`.
const asRegistry =
  (map: ReadonlyMap<string, { name: string }>) =>
  (name: string): { name: string } | undefined =>
    map.get(name);

const readTransition = asRegistry(transitionMap);
const readDecorator = asRegistry(decoratorMap);
const readMorph = asRegistry(morphTransitionMap);

const PRESETS = [
  { file: "cupertino.ts", binding: "cupertino", registered: "cupertino", lookup: readTransition },
  { file: "material.ts", binding: "material", registered: "material", lookup: readTransition },
  { file: "layout.ts", binding: "layout", registered: "layout", lookup: readTransition },
  { file: "none.ts", binding: "none", registered: "none", lookup: readTransition },
  {
    file: "decorator/overlay.ts",
    binding: "overlay",
    registered: "overlay",
    lookup: readDecorator
  },
  {
    file: "morphTransition/shared.ts",
    binding: "shared",
    registered: "shared",
    lookup: readMorph
  },
  { file: "morphTransition/text.ts", binding: "text", registered: "text", lookup: readMorph },
  { file: "morphTransition/zoom.ts", binding: "zoom", registered: "zoom", lookup: readMorph }
] as const;

describe("a built-in preset", () => {
  it.each(PRESETS)("is registered under the name $file documents", (preset) => {
    const source = readFileSync(resolve(TRANSITION_DIR, preset.file), "utf8");
    const emitted = ts.transpileDeclaration(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ESNext
      },
      fileName: preset.file
    }).outputText;

    const doc = new RegExp(
      String.raw`\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s+declare const ${preset.binding}\b`
    ).exec(emitted);
    expect(doc, `${preset.file} publishes no documentation`).not.toBeNull();
    expect(doc![1], `${preset.file} does not name the string it is selected by`).toContain(
      `\`"${preset.registered}"\``
    );
    const registered = preset.lookup(preset.registered);
    expect(registered, `${preset.registered} is not pre-registered`).toBeDefined();
    expect(registered!.name).toBe(preset.registered);
  });
});

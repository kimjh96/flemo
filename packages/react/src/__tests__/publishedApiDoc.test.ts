/// <reference types="node" />

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";
import { describe, expect, it } from "vitest";

// WHAT AN AGENT SEES BEFORE IT HAS READ ANYTHING.
//
// A consumer installs @flemo/react and hovers a prop. Declaration emit keeps
// `/** */` and drops every `//` comment, so a rule written as a line comment
// above a public prop reaches this repository's readers and nobody else. The
// binding's own source has always been dense with those, and the published
// `.d.ts` still read `name: PartTransitionName;` with nothing beside it.
//
// So the rules that decide whether motion comes out right — which Router a
// navigation runs against, which side of a pop is active, which bar hands over
// — are asserted here as declaration output, not as source comments.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const declarationOf = (file: string): string =>
  ts.transpileDeclaration(readFileSync(resolve(SRC, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      jsx: ts.JsxEmit.ReactJSX
    },
    fileName: file
  }).outputText;

const documented = (property: string) =>
  new RegExp(String.raw`\/\*\*(?:(?!\/\*\*)[\s\S])*?\*\/\s+${property}\??:`);

const PUBLIC_SURFACE = [
  {
    file: "Router.tsx",
    declaration: "Router",
    properties: [
      "name",
      "strictRoutes",
      "initPath",
      "defaultTransitionName",
      "transitions",
      "decorators",
      "partTransitions",
      "morphTransitions",
      "history",
      "createDriver",
      "className",
      "style"
    ]
  },
  { file: "Route.tsx", declaration: "Route", properties: ["path", "element"] },
  { file: "Slot.tsx", declaration: "Slot", properties: ["className", "style"] },
  {
    file: "screen/Screen.tsx",
    declaration: "Screen",
    properties: [
      "statusBarHeight",
      "statusBarColor",
      "systemNavigationBarHeight",
      "systemNavigationBarColor",
      "backgroundColor",
      "sharedTopBar",
      "sharedTopBarId",
      "sharedBottomBar",
      "sharedBottomBarId",
      "topBar",
      "bottomBar",
      "hideStatusBar",
      "hideSystemNavigationBar",
      "contentScrollable"
    ]
  },
  { file: "screen/Part.tsx", declaration: "Part", properties: ["name"] },
  { file: "screen/Morph.tsx", declaration: "Morph", properties: ["layoutId", "name", "as"] },
  { file: "screen/Layer.tsx", declaration: "Layer", properties: [] },
  { file: "navigate/useNavigate.ts", declaration: "useNavigate", properties: ["router"] },
  // The rest of the public surface. Props are covered above where the
  // component has its own; these carry the component or hook doc alone.
  { file: "screen/ScreenMotion.tsx", declaration: "ScreenMotion", properties: [] },
  { file: "screen/ScreenFreeze.tsx", declaration: "ScreenFreeze", properties: [] },
  { file: "screen/ScreenDecorator.tsx", declaration: "ScreenDecorator", properties: [] },
  { file: "screen/useScreen.ts", declaration: "useScreen", properties: [] },
  { file: "screen/ParamsProvider/useParams.ts", declaration: "useParams", properties: [] },
  {
    file: "screen/useViewportScrollHeight.ts",
    declaration: "useViewportScrollHeight",
    properties: []
  },
  { file: "navigate/usePathname.ts", declaration: "usePathname", properties: [] },
  { file: "navigate/useStep.ts", declaration: "useStep", properties: [] }
] as const;

// The two registries a consumer must augment before anything type-checks. Both
// cold agents reading only the published tarball reported the augmentation
// target as the one thing they could not determine, so the recipe ships.
const REGISTRIES = [
  { file: "Route.tsx", type: "RegisterRoute", recipe: "declare module" },
  { file: "RouterTarget.ts", type: "RegisterRouter", recipe: "declare module" }
] as const;

describe("published @flemo/react declarations", () => {
  it.each(PUBLIC_SURFACE)("documents $declaration itself", ({ file, declaration }) => {
    expect(declarationOf(file)).toMatch(
      new RegExp(
        String.raw`\/\*\*(?:(?!\/\*\*)[\s\S])*?\*\/\s+(?:export default |export |declare )?function ${declaration}\b`
      )
    );
  });

  it.each(PUBLIC_SURFACE.filter((entry) => entry.properties.length > 0))(
    "documents every public prop of $declaration",
    ({ file, properties }) => {
      const emitted = declarationOf(file);
      for (const property of properties) {
        expect(emitted, `${file}: ${property}`).toMatch(documented(property));
      }
    }
  );

  // The four rules a locally plausible edit gets wrong. Each one is a defect
  // this repository has already shipped and fixed, so each is stated where a
  // consumer reads it rather than only in docs/ this package does not publish.
  it.each([
    ["Router.tsx", "NEAREST enclosing Router"],
    ["Router.tsx", "There is no per-`Route`"],
    ["navigate/useNavigate.ts", "IGNORED rather"],
    ["screen/Morph.tsx", "the departing one is CUT"],
    ["screen/Morph.tsx", "which is the INACTIVE side"],
    ["screen/Part.tsx", "Easing never inherits"],
    ["screen/Screen.tsx", "same `sharedTopBarId`"],
    // Corrections found by checking each published sentence against the code
    // it describes. Each replaced a claim that was wrong in a way an author
    // would act on, so each is pinned rather than left to be re-broken.
    ["screen/Morph.tsx", "authors no DURATION"],
    ["screen/Morph.tsx", "Its curve is authored rather than"],
    ["screen/Screen.tsx", "verifiably opaque surface"],
    ["navigate/useNavigate.ts", "`skip` below the top"]
  ])("states in %s that %s", (file, claim) => {
    expect(declarationOf(file)).toContain(claim);
  });

  it.each(REGISTRIES)("ships the $type augmentation recipe", ({ file, type, recipe }) => {
    const emitted = declarationOf(file);
    const doc = new RegExp(
      String.raw`\/\*\*((?:(?!\/\*\*)[\s\S])*?)\*\/\s+(?:export )?interface ${type}\b`
    ).exec(emitted);
    expect(doc, `${type} lost its documentation`).not.toBeNull();
    expect(doc![1]).toContain(recipe);
    expect(doc![1]).toContain(`interface ${type}`);
  });
});

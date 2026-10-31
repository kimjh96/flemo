# React package contract

The supplied `packages/react/package.json` names `@flemo/react` at version `2.6.2`. Its declarations do not establish publication or packed-artifact validation.

## Entrypoints and dependencies

The manifest declares `type: "module"`. Both `main` and `module` point to `./dist/index.mjs`; `types` points to `./dist/index.d.ts`. There is no `exports` map. These fields do not establish additional supported subpath APIs.

React and React DOM are peers with range `^19.2.8` each. Development dependencies separately declare `react` and `react-dom` as `^19.3.0`; these ranges do not replace consumer peer requirements.

Runtime dependencies are `@flemo/core: workspace:*`, `path-to-regexp: ^8.4.2`, and `zustand: ^5.0.15`. The workspace declaration does not show the dependency range produced in a published package.

## Packaging and validation

The manifest declares `sideEffects: false`, a `files` allowlist containing `dist`, and public publish access. These declarations do not prove bundle elimination or an inspected archive's exact contents.

Scripts use Vite for build and watch, ESLint for lint, `tsc --noEmit` for typechecking, and Vitest for tests, coverage, and test watching. `clean` removes `dist` and `.turbo`. Full repository validation is governed by [workspace commands](../../../instructions/workspace-commands.md).

No build, test, packed smoke test, registry lookup, or publication was observed in this assessment.

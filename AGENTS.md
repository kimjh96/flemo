# flemo workspace rules

Build changes that pass CI in this Turborepo + pnpm monorepo for the flemo screen-transition library.

## Layout

```
packages/core             @flemo/core (framework-agnostic — task queue, stores,
                          transition factories + presets, CSS keyframes compiler,
                          pure utils)
packages/react            @flemo/react (Router/Route/Screen/hooks + the React-side
                          runtime that mounts the compiled styles and drives
                          navigation tasks)
packages/devtools         @flemo/devtools (zero-dependency flight recorder +
                          visual panel — a pure CONSUMER of the DOM surfaces the
                          engine already exposes; imports nothing from core/react)
packages/react-layout     @flemo/react-layout (DEPRECATED, removal pending — the
                          old motion-based LayoutScreen/LayoutConfig. Shared
                          elements are now <Morph> in @flemo/react over the
                          framework-neutral morph runtime in @flemo/core/src/morph)
packages/eslint-config    @flemo/eslint-config (internal, base/react/nextjs presets)
packages/tsconfig         @flemo/tsconfig (internal, base/react-library/nextjs)
apps/web                  @flemo/web — Next.js 16 landing + docs (ko/en); the site
                          itself is a flemo Router app (docs content is typed data in
                          app/[lang]/docs/_data, no MDX), with the live playground at
                          /playground
```

Published packages are `@flemo/core`, `@flemo/react`, `@flemo/react-layout`, and `@flemo/devtools`. Devtools is a published, changeset-versioned package despite being development tooling. `@flemo/web` is private but changeset-versioned so its `CHANGELOG.md` records deployable changes. Ignore internal `@flemo/eslint-config` and `@flemo/tsconfig`. No `flemo` meta package exists; consumers install `@flemo/react`. Shared-element morphs are in that package, while `@flemo/react-layout` is a deprecated stub awaiting removal.

## Non-negotiable rules

1. Never manually edit `package.json#version` in `packages/core`, `packages/react`, `packages/react-layout`, `packages/devtools`, or `apps/web`. For every user-visible change, create `.changeset/<short-kebab-slug>.md` without using the interactive `pnpm changeset` prompt or delegating it to the user:

```md
   ---
   "@flemo/react": minor
   ---

   1–2 sentence user-facing summary. Imperative voice.
   ```

List each affected package (`@flemo/core`, `@flemo/react`, `@flemo/react-layout`, `@flemo/devtools`, or `@flemo/web`) on its own frontmatter line. Use `patch` for fixes/internal changes, `minor` for features, and `major` only for actual API breaks. Skip changesets only for typos, behavior-neutral internal refactors, or documentation-only edits outside `docs/*`. Release automation creates the Version PR, versions, changelogs, npm publications, and GitHub Releases; write the summary for changelog readers.

2. Do not add files under `packages/core`, `packages/react`, `packages/react-layout`, or `packages/devtools` unless they ship to npm; each package's `files` field is `["dist"]`. Put fixtures, demos, and scratch code in `apps/web/app/[lang]/playground/`—organized into `_components/`, `_screens/`, `_router/`, `_data/`, `_hooks/`, `_providers/`, and `_transitions/`—or a new `examples/*` workspace.

3. Keep CI green. Run this from the repository root before completion:

```bash
   pnpm turbo run typecheck lint test build
   ```

CI installs with `pnpm install --frozen-lockfile`. Local development may use `bun install` and `bunx turbo run typecheck lint test build`; do not commit `bun.lock` churn unless dependencies changed. If validation cannot run, report that explicitly and do not claim success.

4. Do not disable lint or type rules. Fix reported code. Only `@typescript-eslint/no-explicit-any` in MDX glue and `react/no-unescaped-entities` in marketing copy are pre-approved exceptions.
5. The playground must import the real `@flemo/react` artifact through `workspace:*`; never replace it with a mock.
6. Keep `@flemo/core` framework-agnostic: no React, DOM-only React hooks, or motion runtime imports. Define animation target types locally in `packages/core/src/transition/cssTypes.ts`; do not import motion types into core.

## Conventions

- Canonical instructions are this file, `packages/react/CLAUDE.md`, `apps/web/CLAUDE.md`, `docs/architecture/motion-engine.md`, `docs/architecture/driver-routing.md`, `docs/diagnostics.md`, and `docs/postmortems/`. There is no `.claude/rules/` directory.
- Read both architecture documents before changing `packages/core/src/core/engine/`. Check postmortems before designing a motion fix.
- Follow surrounding style. Every React component, including subcomponents, has its own folder and `index.ts` barrel; see `apps/web/components/*` and `apps/web/app/[lang]/playground/_components/*`.
- Core aliases are `@core`, `@history`, `@morph`, `@navigate`, `@transition`, and `@utils`. Register new top-level source aliases in both `packages/core/tsconfig.json` and `vite.config.mts`/`vitest.config.ts`.
- React aliases are `@history`, `@navigate`, `@renderer`, `@screen`, `@transition`, `@utils`, `@Route`, and `@Router`. Import cross-package core APIs as named imports from `@flemo/core`; never use core path aliases.
- Do not use default React imports such as `import React from "react"`; use named imports.
- Use `import type {...}` for type-only imports.
- A package's public API consists of exports from its `src/index.ts`; export new public modules there.

## References

- Engine tiers, flight lifecycle, leases, and resolution invariants: `docs/architecture/motion-engine.md`
- Driver decisions, pins, and demotion: `docs/architecture/driver-routing.md`
- `flemo:*` flags, URL arming, e2e helpers, and observation pitfalls: `docs/diagnostics.md`
- Device history and do-not-retry list: `docs/postmortems/2026-08-motion-jank.md`
- React architecture: `packages/react/CLAUDE.md`
- Core primitives: `packages/core/src/index.ts`
- Web, playground, and e2e: `apps/web/CLAUDE.md`
- Aliases: `packages/core/tsconfig.json`, `packages/react/tsconfig.json`
- Lint: `packages/eslint-config/index.mjs`, `react.mjs`
- CI: `.github/workflows/ci.yml`
- Releases: `.github/workflows/release.yml`, `.changeset/config.json`

## Change workflow

1. Put framework-agnostic work in `@flemo/core` and React-coupled work in `@flemo/react`. Shared-element geometry, keyframes, and pairing belong in core's `src/morph`; the React binding is `<Morph>`, not a separate package.
2. For changes under `packages/core/src/**`, `packages/react/src/**`, or `packages/react-layout/src/**`, add a colocated test under `__tests__/`. Cover every branch you add: a PR must leave Codecov reporting no missing lines and no partials, so check `gh pr view <n>` for the ✗/⚠ report rather than only the pass/fail checks, which stay green under a coverage drop. Where a branch cannot be reached, delete it instead of leaving it untested.
3. Run the full CI command from the repository root.
4. For user-visible changes, create the required changeset with affected packages and a one- or two-sentence release-ready summary.
5. Stage source and changeset in the same commit.

<!-- lervo:begin block=repository_instruction_routes schema=1 -->
## Repository instruction routes

- Read the verified current state with `lervo workstream current --context` before continuing repository work.
- Before completing a terminal turn, create the first bounded checkpoint with `lervo workstream start` or advance the existing snapshot with `lervo workstream update`; perform this agent bookkeeping without asking the user to run it.
- Translate explicit natural-language requests to hire, assign, inspect, resolve, hand off, or retire repository agents into `lervo agent`, `lervo assignment`, and workstream operations yourself; when authority or scope is ambiguous, record one bounded pending decision instead of guessing or asking for a bookkeeping command.
- Resolve roles with `lervo role list|show|validate`; treat the six built-ins as templates, author a lazy `.lervo/roles/<role-id>.json` source when a requested repository role does not exist, and never bypass version, hash, capability, verification, or ancestry validation.
- Register every subagent with its parent and apply the same durable identity, scoped lease, path-conflict, evidence, verification, and finalization contracts used for root agents.
<!-- lervo:end block=repository_instruction_routes -->

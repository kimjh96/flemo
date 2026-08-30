# flemo workspace rules

Build CI-passing changes in this Turborepo and pnpm monorepo for the flemo screen-transition library.

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
packages/eslint-config    @flemo/eslint-config (internal, base/react/nextjs presets)
packages/tsconfig         @flemo/tsconfig (internal, base/react-library/nextjs)
apps/web                  @flemo/web — Next.js 16 landing + docs (ko/en); the site
                          itself is a flemo Router app (docs content is typed data in
                          app/[lang]/docs/_data, no MDX), with the live playground at
                          /playground
```

- Published and changeset-versioned: `@flemo/core`, `@flemo/react`, and `@flemo/devtools`.
- `@flemo/web` is private but changeset-versioned. Ignore internal `@flemo/eslint-config` and `@flemo/tsconfig`.
- No `flemo` meta package exists. Consumers install `@flemo/react`. Shared-element morphs use `<Morph>` there and the framework-neutral runtime in `@flemo/core/src/morph`.
- Removed `@flemo/react-layout` remains at its last published version, `0.1.52`; nothing here builds or references it.

## Non-negotiable rules

1. Never manually edit `package.json#version` in published packages or `apps/web`. For each user-visible change, create `.changeset/<short-kebab-slug>.md` without the interactive prompt or user delegation:

```md
   ---
   "@flemo/react": minor
   ---

   1–2 sentence user-facing summary. Imperative voice.
   ```

List every affected versioned package on its own frontmatter line. Use `patch` for fixes or internal changes, `minor` for features, and `major` only for API breaks. Skip changesets only for typos, behavior-neutral internal refactors, or documentation-only edits outside `docs/*`. Release automation owns versions, changelogs, npm publication, and GitHub Releases.
2. Add files under published packages only when they ship to npm; their `files` field is `["dist"]`. Put fixtures, demos, and scratch code in the playground's `_components/`, `_screens/`, `_router/`, `_data/`, `_hooks/`, `_providers/`, or `_transitions/`, or in a new `examples/*` workspace.
3. Run this at the repository root before completion:

```bash
   pnpm turbo run typecheck lint test build
   ```

CI uses `pnpm install --frozen-lockfile`. Local development may use `bun install` and `bunx turbo run typecheck lint test build`; commit `bun.lock` churn only when dependencies change. If validation cannot run, report that and do not claim success.
4. Do not disable lint or type rules. Only `@typescript-eslint/no-explicit-any` in MDX glue and `react/no-unescaped-entities` in marketing copy are pre-approved exceptions.
5. The playground imports the real `@flemo/react` artifact through `workspace:*`, never a mock.
6. Keep `@flemo/core` framework-agnostic. Define animation target types in `packages/core/src/transition/cssTypes.ts`; do not import React, DOM-only React hooks, or motion types/runtime into core.

## Conventions

- Canonical instructions: this file, `apps/web/CLAUDE.md`, `docs/architecture/motion-engine.md`, `docs/architecture/driver-routing.md`, `docs/architecture/react-binding.md`, `docs/instructions/diagnostics.md`, and `docs/instructions/motion-jank-postmortem/`. There is no `.claude/rules/`.
- Before changing `packages/core/src/core/engine/`, read both engine architecture documents and the motion postmortems.
- Match surrounding style. Every React component and subcomponent has its own folder and `index.ts` barrel.
- Core aliases: `@core`, `@history`, `@morph`, `@navigate`, `@transition`, `@utils`. Register new top-level aliases in `packages/core/tsconfig.json`, `vite.config.mts`, and `vitest.config.ts`.
- React aliases: `@history`, `@navigate`, `@renderer`, `@screen`, `@transition`, `@utils`, `@Route`, `@Router`. Import core APIs as named imports from `@flemo/core`, never through core path aliases.
- Use named React imports and `import type {...}` for type-only imports.
- A package's public API is its `src/index.ts` exports; export new public modules there.
- Commit bodies contain three to six hyphen bullets, one point each, with no prose paragraphs or footer except `Co-Authored-By`. Do not include session URLs.
- Do not use em dashes in commit messages, pull request titles or bodies, changesets, or `docs/`. Preserve existing code comments and match edited files rather than sweeping them.

## Change workflow

1. Put framework-neutral work in `@flemo/core` and React-coupled work in `@flemo/react`. Shared-element geometry, keyframes, and pairing belong in core's `src/morph`; the React binding is `<Morph>`.
2. For changes under `packages/core/src/**`, `packages/react/src/**`, or `packages/devtools/src/**`, add a colocated test under `__tests__/`.
3. Run the full CI command from the repository root.
4. Add the required release-ready changeset for user-visible changes.
5. Stage source and changeset in the same commit.

## References

- Engine lifecycle and invariants: `docs/architecture/motion-engine.md`
- Driver routing: `docs/architecture/driver-routing.md`
- React architecture: `docs/architecture/react-binding.md`
- Diagnostics: `docs/instructions/diagnostics.md`
- Motion history: `docs/instructions/motion-jank-postmortem.md`
- Core API: `packages/core/src/index.ts`
- Web and e2e: `apps/web/CLAUDE.md`
- CI and releases: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.changeset/config.json`

<!-- lervo:begin block=repository_instruction_routes schema=1 -->
## Repository instruction routes

- Read the verified current state with `lervo workstream current --context` before continuing repository work.
- Before completing a terminal turn, create the first bounded checkpoint with `lervo workstream start` or advance the existing snapshot with `lervo workstream update`; perform this agent bookkeeping without asking the user to run it.
- Translate explicit natural-language requests to hire, assign, inspect, resolve, hand off, or retire repository agents into `lervo agent`, `lervo assignment`, and workstream operations yourself; when authority or scope is ambiguous, record one bounded pending decision instead of guessing or asking for a bookkeeping command.
- Resolve roles with `lervo role list|show|validate`; treat the six built-ins as templates, author a lazy `.lervo/roles/<role-id>.json` source when a requested repository role does not exist, and never bypass version, hash, capability, verification, or ancestry validation.
- Register every subagent with its parent and apply the same durable identity, scoped lease, path-conflict, evidence, verification, and finalization contracts used for root agents.
- For all repository work, read [coverage](docs/instructions/coverage.md).
- For all repository work, read [diagnostics](docs/instructions/diagnostics.md).
- For all repository work, read [motion-jank-postmortem](docs/instructions/motion-jank-postmortem.md).
- For all repository work, read [addendum-2026-08-17](docs/instructions/motion-jank-postmortem/addendum-2026-08-17.md).
- For all repository work, read [desktop-player-blank](docs/instructions/motion-jank-postmortem/desktop-player-blank.md).
- For all repository work, read [do-not-retry](docs/instructions/motion-jank-postmortem/do-not-retry.md).
- For all repository work, read [glass-campaign-2026-08-18](docs/instructions/motion-jank-postmortem/glass-campaign-2026-08-18.md).
- For all repository work, read [long-content-reveal-block-2026-08-30](docs/instructions/motion-jank-postmortem/long-content-reveal-block-2026-08-30.md).
<!-- lervo:end block=repository_instruction_routes -->

<!-- lervo:begin block=development_pattern_routes schema=1 -->
## Promoted development patterns

- [Read the Codecov report, not the Codecov checks](docs/instructions/coverage.md)
<!-- lervo:end block=development_pattern_routes -->

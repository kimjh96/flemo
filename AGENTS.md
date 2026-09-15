# flemo workspace rules

Build CI-passing changes in this Turborepo and pnpm monorepo for the flemo screen-transition library.

## Layout and ownership

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

- Publish and changeset-version `@flemo/core`, `@flemo/react`, and `@flemo/devtools`. Changeset-version private `@flemo/web`; ignore internal `@flemo/eslint-config` and `@flemo/tsconfig`.
- No `flemo` meta package exists; consumers install `@flemo/react`. Shared-element morphs use its `<Morph>` binding and the framework-neutral runtime in `@flemo/core/src/morph`.
- Removed `@flemo/react-layout` remains at `0.1.52`; do not build or reference it.
- Put framework-neutral work, including shared-element geometry, keyframes, and pairing, in core (`src/morph` for morphs); put React-coupled work in react.

## Change and release requirements

- Never edit `package.json#version` manually in published packages or `apps/web`. For every user-visible change, create `.changeset/<short-kebab-slug>.md` non-interactively:

```md
   ---
   "@flemo/react": minor
   ---

   1–2 sentence user-facing summary. Imperative voice.
   ```

- List every affected versioned package on its own frontmatter line. Use `patch` for fixes or internal changes, `minor` for features, and `major` only for API breaks. Skip changesets only for typos, behavior-neutral internal refactors, or documentation-only edits outside `docs/*`. Release automation owns versions, changelogs, npm publication, and GitHub Releases.
- Add files under published packages only when they ship to npm; each package's `files` field is `["dist"]`. Put fixtures, demos, and scratch code in the playground's `_components/`, `_screens/`, `_router/`, `_data/`, `_hooks/`, `_providers/`, or `_transitions/`, or a new `examples/*` workspace.
- For changes under `packages/core/src/**`, `packages/react/src/**`, or `packages/devtools/src/**`, add a colocated test under `__tests__/`.
- Before completion, run the full CI command at the repository root:

```bash
   pnpm turbo run typecheck lint test build
   ```

- CI runs `pnpm install --frozen-lockfile`. Local development may use `bun install` and `bunx turbo run typecheck lint test build`; commit `bun.lock` churn only when dependencies change. If validation cannot run, report it and do not claim success.
- Add the required release-ready changeset for user-visible changes and stage source and changeset in the same commit.

## Implementation constraints

- Do not disable lint or type rules. Only `@typescript-eslint/no-explicit-any` in MDX glue and `react/no-unescaped-entities` in marketing copy are pre-approved exceptions.
- The playground must import the real `@flemo/react` artifact through `workspace:*`, never a mock.
- Keep `@flemo/core` framework-agnostic. Define animation target types in `packages/core/src/transition/cssTypes.ts`; never import React, DOM-only React hooks, or motion types/runtime into core.
- Match surrounding style. Give every React component and subcomponent its own folder and `index.ts` barrel.
- Core aliases: `@core`, `@history`, `@morph`, `@navigate`, `@transition`, `@utils`. Register new top-level aliases in `packages/core/tsconfig.json`, `vite.config.mts`, and `vitest.config.ts`.
- React aliases: `@history`, `@navigate`, `@renderer`, `@screen`, `@transition`, `@utils`, `@Route`, `@Router`. Import core APIs as named imports from `@flemo/core`, never core path aliases.
- Use named React imports and `import type {...}` for type-only imports.
- A package's public API is its `src/index.ts` exports; export new public modules there.

## Canonical guidance

- Canonical instructions: this file, `apps/web/AGENTS.md`, `docs/architecture/motion-engine.md`, `docs/architecture/driver-routing.md`, `docs/architecture/react-binding.md`, `docs/instructions/diagnostics.md`, `docs/instructions/transition-authoring.md`, and `docs/instructions/motion-jank-postmortem/`. There is no `.claude/rules/`.
- Keep agent guidance provider-neutral and derived from canonical sources. The portable skill lives at `.agents/skills/flemo`; provider-specific paths and root context files are discovery adapters only.
- Generate the web's `llms.txt` and `llms-full.txt` from `apps/web/app/[lang]/docs/_data/docPages.ts`; never maintain separate prose.
- Before changing `packages/core/src/core/engine/`, read both engine architecture documents and the motion postmortems.
- Before authoring or changing any transition, morph, part, or decorator in packages or the playground, read `docs/instructions/transition-authoring.md` for the role table, factory slot vocabulary, clock-inheritance rules, and symptom-to-cause index.

## Commit and pull request conventions

- Scope commit subjects and pull request titles to the owning package: `fix(core):`, `fix(react):`, `feat(core):`, or `perf(react):`. For cross-package changes, name the owning package; a compiler change with a binding rendering its attribute is `(core)`. Only `chore:` and `docs:` are unscoped.
- Commit bodies must contain three to six single-point hyphen bullets, with no prose paragraphs or footer except `Co-Authored-By`. Do not include session URLs.
- Do not use em dashes in commit messages, pull request titles or bodies, changesets, or `docs/`. Preserve existing code comments and match edited files instead of sweeping them.

## References

- Engine lifecycle and invariants: `docs/architecture/motion-engine.md`
- Driver routing: `docs/architecture/driver-routing.md`
- React architecture: `docs/architecture/react-binding.md`
- Transition authoring: `docs/instructions/transition-authoring.md`
- Diagnostics: `docs/instructions/diagnostics.md`
- Motion history: `docs/instructions/motion-jank-postmortem.md`
- Core API: `packages/core/src/index.ts`
- Web and e2e: `apps/web/AGENTS.md`
- CI and releases: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `.changeset/config.json`

<!-- lervo:begin block=repository_instruction_routes schema=2 -->
## Repository instruction bootstrap

- Read the verified current state with `lervo workstream current --context` before continuing repository work.
- Before changing repository bytes, resolve applicable canonical instructions and portable skills with `lervo knowledge query "<task purpose and target paths>"`; read the returned sources before acting. The knowledge registry is authoritative, so do not grow this entrypoint with one route per rule or skill.
- Before completing a terminal turn, create the first bounded checkpoint with `lervo workstream start` or advance the existing snapshot with `lervo workstream update`; perform this agent bookkeeping without asking the user to run it.
- Translate explicit natural-language requests to hire, assign, inspect, resolve, hand off, or retire repository agents into `lervo agent`, `lervo assignment`, and workstream operations yourself; when authority or scope is ambiguous, record one bounded pending decision instead of guessing or asking for a bookkeeping command.
- Resolve roles with `lervo role list|show|validate`; treat the six built-ins as templates, author a lazy `.lervo/roles/<role-id>.json` source when a requested repository role does not exist, and never bypass version, hash, capability, verification, or ancestry validation.
- Register every subagent with its parent and apply the same durable identity, scoped lease, path-conflict, evidence, verification, and finalization contracts used for root agents.
<!-- lervo:end block=repository_instruction_routes -->

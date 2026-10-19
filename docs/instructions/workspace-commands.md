# Workspace commands

The root `package.json` declares Node.js `>=22.23.3` and `pnpm@12.9.1`. Run workspace commands from the repository root. CI installs dependencies with `pnpm install --frozen-lockfile`.

## Development and validation

`pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` invoke the corresponding Turborepo task. Before completing repository changes, follow the root guidance and run:

```bash
pnpm turbo run typecheck lint test build
```

`pnpm build:packages` runs the build task with explicit filters for `@flemo/core`, `@flemo/react`, and `@flemo/devtools`.

`pnpm clean` first runs `turbo run clean`. Only if that succeeds, it recursively removes the root `node_modules` and `.turbo` directories.

## Formatting and hooks

`pnpm format` runs Prettier in write mode with `./.prettierrc` over `**/*.{js,mjs,ts,jsx,tsx,mts,json,md,mdx}`. `pnpm convention` runs that formatter, then runs `turbo run lint -- --fix` if formatting succeeds.

The lint-staged configuration runs `prettier --write --ignore-unknown` for matching staged JavaScript, TypeScript, JSON, Markdown, and MDX files. The `prepare` script invokes Husky. `pnpm size` invokes size-limit.

## Release and evaluation entrypoints

`pnpm changeset` invokes the Changesets CLI. `pnpm version-packages` maps to `changeset version`. `pnpm release` builds with the `./packages/*` filter and invokes `changeset publish` only if that build succeeds. Release automation owns versions, changelogs, npm publication, and GitHub Releases; these script definitions do not establish that a release has occurred.

For `eval:agents:validate`, `eval:agents:prepare`, `eval:agents:ladder`, `eval:agents:analyse`, `eval:agents:score`, and `eval:agents:selftest`, follow the [agent-guidance evaluation guide](../../evals/flemo-agent-guidance/README.md), including its release-corpus, isolation, scoring, and analysis requirements.

# Development and validation

From the repository root, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`, and `pnpm test` invoke the corresponding Turborepo task. Before completing repository changes, follow the root guidance and run:

```bash
pnpm turbo run typecheck lint test build
```

`pnpm build:packages` runs the build task with explicit filters for `@flemo/core`, `@flemo/react`, and `@flemo/devtools`.

`pnpm clean` runs `turbo run clean`, then recursively removes the root `node_modules` and `.turbo` directories only if that task succeeds.

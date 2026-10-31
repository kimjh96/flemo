# Formatting and hooks

Run commands from the repository root.

`pnpm format` runs Prettier in write mode with `./.prettierrc` over `**/*.{js,mjs,ts,jsx,tsx,mts,json,md,mdx}`. `pnpm convention` runs that formatter, then `turbo run lint -- --fix` only if formatting succeeds.

The lint-staged configuration runs `prettier --write --ignore-unknown` for matching staged JavaScript, TypeScript, JSON, Markdown, and MDX files. The `prepare` script invokes Husky. `pnpm size` invokes size-limit.

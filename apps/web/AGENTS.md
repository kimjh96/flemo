# This is NOT the Next.js you know

This Next.js version has breaking API, convention, and file-structure changes. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`, resolving it from this file's directory because `next` may not be visible from the monorepo root. Heed deprecation notices.

`next dev` writes and restores this block. Verify that behavior in `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing the block only recreates an uncommitted change; commit it with your work to keep the tree clean.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# This is NOT the Next.js you know

This Next.js version has breaking API, convention, and file-structure changes. Before writing code, read the relevant guide in `node_modules/next/dist/docs/`, resolving it from this file's directory because `next` may not be visible from the monorepo root. Heed deprecation notices.

`next dev` writes and restores this block. Verify that behavior in `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing the block only recreates an uncommitted change; commit it with your work to keep the tree clean.

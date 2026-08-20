# @flemo/web · app notes for agents

Next.js 16 app. Private, not published, but versioned by changesets (its CHANGELOG
tracks deployable changes). It is simultaneously the marketing/docs site AND the
library's living test fixture — the whole site is itself a flemo app.

## Structure

- `app/[lang]/` — locale-prefixed routes (ko/en; `lib/i18n.ts`, `lib/cookie.ts`).
  The marketing surface is ONE root flemo `<Router>` (`_router/ShellRouter`) with a
  `<Slot>`: `SiteHeader` is persistent chrome outside the Slot; Home / Docs /
  Showcase are peer screens with shared-axis slide transitions, over a locale-aware
  history driver (`lib/localeHistoryDriver.ts` — the Router stays in unprefixed path
  space).
- **Docs are NOT Fumadocs/MDX anymore** (despite older notes): content lives as typed
  data in `app/[lang]/docs/_data/docPages.ts` (shared slugs, localized copy — Korean
  in 해요체, no em-dashes) rendered by `docs/[slug]/page.tsx`.
- `app/[lang]/_demo/` — the wallet/music in-screen demos; `components/atoms|molecules`
  — site-wide UI, every component a folder with an `index.ts` barrel.

## E2E (`e2e/`)

- Playwright projects: `chromium` (Desktop Chrome) and `mobile-chromium` (Pixel 7 —
  where the player-tier specs run against a PINNED player; Blink routes the compiled
  tier everywhere, so the force pin is the player's only route there). There is NO
  webkit project — `c5a2742` dropped it, so the `browserName === "webkit"` skips left
  in the specs are dead guards and WebKit routing has no CI coverage at all (it is
  device-judged). CI runs
  `--project=chromium --project=mobile-chromium` against a production build.
- `helpers/flemo.ts` — `data-flemo-*` locators, `waitForNavIdle` (NEVER fixed waits:
  the player's capped clock legitimately stretches flights on a stalled runner; wait
  on engine state), console-error tracking.
- More toggles and observation pitfalls: the flag registry table at the top of
  `packages/core/src/core/engine/diagnosticFlags.ts` (the untracked `docs/` set is
  maintainer-local; see .gitignore).

## Running Playwright locally

The config's `webServer` runs `pnpm build && pnpm start` — on a machine without pnpm,
reuse your own server instead (`reuseExistingServer: !isCI`):

```bash
bun run --filter @flemo/web build
PORT=3100 bunx next start apps/web -p 3100 &   # or: cd apps/web && bun run start -p 3100
cd apps/web && PORT=3100 bunx playwright test --project=chromium
```

`PORT` feeds both the config's baseURL and the webServer URL, and an already-running
server on that port is reused, skipping the pnpm command entirely. Always test against
the production build — dev/fast-refresh adds main-thread work that flakes the
timing-sensitive specs.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

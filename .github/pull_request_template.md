<!--
Title: scope it to the owning package, e.g. `fix(core): …`, `feat(react): …`.
Only `chore:` and `docs:` are unscoped. No em dashes in the title or body.
A user-visible change needs a `.changeset/*.md` in the same commit.
Write prose. Delete these comments and any section that has nothing to say.
-->

## Why

<!--
The problem as a reader would meet it: what was wrong, missing or impossible,
and how it showed. Include the measurement or the reproduction if there is one.
-->

## What changed

<!--
What the change does, starting with what a consumer can now write or will now
see. Show the API in a short code block when there is one. Then the decisions
a reviewer would ask about, each in its own short paragraph.
-->

## Verification

<!--
`pnpm turbo run typecheck lint test build` and its result, the web e2e result,
and the tests this adds: what each one pins, and that it fails without the
change. Say whether every changed line is covered.
-->

## What this does not cover

<!--
The cases it leaves alone, what is still open, and anything shipped as a
capability with nothing in this repository exercising it yet.
-->

# Release entrypoints

Run commands from the repository root.

`pnpm changeset` invokes the Changesets CLI. `pnpm version-packages` maps to `changeset version`. `pnpm release` builds with the `./packages/*` filter and invokes `changeset publish` only if that build succeeds.

Release automation owns versions, changelogs, npm publication, and GitHub Releases. These script definitions do not establish that a release has occurred.

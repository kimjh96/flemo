---
"@flemo/devtools": minor
"@flemo/web": patch
---

Ship the devtools as a component. `@flemo/devtools/react` exports
`<FlemoDevtools />`, and that is the whole wiring: leave it in the tree and ship
it, because under the `production` export condition the same specifier resolves
to a component that renders null and imports nothing. The production entry
measures 42 bytes and is now held there by a bundle-size budget.

It replaces an imperative shape that made every consumer learn too much. Mounting
the panel and the readout by hand meant an effect, a dynamic import, a
cancellation flag, two detach calls, and knowing which export condition resolves
where. The first consumer to get that wrong was this project's own playground:
reaching for `@flemo/devtools/force` to make the instrument exist in a production
build put the real panel and readout straight back into a public chunk, because
the specifier survives whatever guard is wrapped around it. The site now mounts
`<FlemoDevtools />` unconditionally, and an end-to-end test asserts the built
output mounts no devtools surface at all.

The imperative `attachDevtoolsPanel`, `attachDevtoolsHud` and
`attachFlightRecorder` are unchanged and stay the entry point for anything that
is not React. `react` is an optional peer dependency, needed only for the new
entry. `dist` gains `react.mjs` and `reactNoop.mjs`, and the package's watch mode
now rebuilds every entry rather than only the first.

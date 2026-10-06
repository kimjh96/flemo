# Quickstart

- [React](quickstart/react.md): render `<FlemoDevtools />` unconditionally.
- [Any framework](quickstart/any-framework.md): attach a recorder and inspect its report.

With an unconditional `<FlemoDevtools />`, the recorder and panels exist only in development builds. The [judging protocol](judging.md) rejects development-build numbers as evidence. Production resolves to the inert entry, so nothing is instrumented accidentally and no flag is needed.

The old `flemo:devtools` opt-in key is retired; sessions that still have it report it as a leftover key.

For intentional instrumentation of staging builds or production-build E2E, see [production safety](production-safety.md).

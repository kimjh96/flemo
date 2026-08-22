---
"@flemo/core": minor
"@flemo/react": patch
---

Resolve every per-browser decision in one place. `@flemo/core` now exports
`resolvePlatformProfile()`, which returns the atomic release flip, the render-settle
gate, the deferred release commit, the park-over hold, the rest promotion and the
image-decode offload as named fields. `@flemo/react` asks for the profile and renders
the answer instead of combining engine probes and diagnostic flags itself, so a
binding for another framework has no policy to re-implement.

Platform detection modules (`engineProbes`, `governedCompiled`, `steadySixtyCadence`,
`displayCadence`) moved out of the engine directory to sit beside the profile. The
raw flag readers are no longer part of core's public surface — ask the profile.

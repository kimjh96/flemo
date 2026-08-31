---
"@flemo/core": minor
"@flemo/react": patch
"@flemo/devtools": minor
---

Remove the `flemo:*` diagnostic flag surface from the shipped library. Core read
24 session keys and exported the registry that described them, so every key
string and every explanation shipped in a consumer's bundle; each key is now a
computed default with no override. `DIAGNOSTIC_FLAGS`, `RETIRED_DIAGNOSTIC_FLAGS`,
`parkHeadEnabled`, `restLayerPromotionEnabled` and `PlatformProfile.restLayerPromotion`
are gone from the public API, and the machinery only a flag could arm goes with
them: the image reveal hold, the REST-time layer promotion, the resident-layer
and shallow-freeze experiments, and the morph decision trace. Per-browser
behavior is unchanged, because no consumer set these keys. `@flemo/devtools` now
lists every engine key as retired residue, so a device still carrying one is told
it explains nothing.

Released as a minor rather than a major on purpose: the removed exports described
a diagnostic surface nothing consumed at runtime, and `@flemo/devtools` mirrored
the registry through a test-only dependency rather than importing it.

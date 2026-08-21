---
"@flemo/core": patch
---

Stop reading diagnostic toggles from the URL. `?flemo-layers=` and
`?flemo-freeze=` wrote a session key on any visit, so a link was enough to
change how the library behaved for the rest of that tab. Both toggles keep
working through their `flemo:layers` / `flemo:freeze` session keys.

---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/web": patch
---

`useNavigate().pop` and `replace` now take an optional distance — `{ count }` (a number of screens) or `{ until }` (a route pattern) — to reach past the top in a single transition. The skipped screens are removed without ever painting, so they never flash by; only the screen you land on animates.

- `pop({ count })` pops N screens (clamped to the stack depth); `pop({ until })` pops back to the nearest matching screen and lands on it.
- `replace(path, params, { count })` collapses the top N screens into the new one; `replace(path, params, { until })` collapses down to and including the nearest match.

`{ count }` / `{ until }` are mutually exclusive (`until` wins); an unmatched `until` or non-positive `count` is a no-op. Plain `pop()` / `replace(path)` are unchanged.

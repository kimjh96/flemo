---
"@flemo/react": patch
---

`Router` now splits a query off `initPath` (such as `/playground/1?code=x`) and seeds the matched route's params from it, so a deep link or refresh renders the right step state on load. A plain `initPath` with no query is unchanged.

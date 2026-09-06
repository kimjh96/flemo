---
"@flemo/web": patch
---

Make the Morph docs describe the options that exist. The table listed `scale`
and `anchor`, neither of which the API has: `scale` was implemented and withdrawn
before it shipped, `anchor` never existed. It also gave `crossFade`'s default as
0.12 where the runtime uses 0.55, described `radius` as interpolating
"scale-corrected endpoints" when nothing is scaled, and left out `carry`
entirely, which is the option the page's own "when the element IS the screen"
section spends a paragraph describing.

The table is now keyed by `Record<keyof MorphTransitionOptions, string>`, so
renaming or dropping an option in core stops the site compiling instead of
leaving the table quietly wrong. Verified by renaming one: both locales fail the
typecheck, at the row.

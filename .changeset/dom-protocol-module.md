---
"@flemo/core": minor
"@flemo/react": patch
"@flemo/devtools": patch
---

Declare the `data-flemo-*` DOM contract in one place. `@flemo/core` now exports the
whole protocol — every attribute name, the animation hold's values, and selector
helpers — instead of spreading ~27 string literals across four packages where a
rename broke the others silently. Consumers styling or querying flemo's attributes
can import the names rather than hard-code them.

The contract is now enforced from both ends: core fails its own suite on any raw
`data-flemo-*` literal, the React binding fails if it renders an attribute core does
not declare, and the devtools recorder's deliberately-separate copy is pinned against
core's table.

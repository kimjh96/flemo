---
"@flemo/core": patch
---

Add `docs/instructions/transition-authoring.md`: which side of a flight each
status and active flag names, what `enter` means in each of the four factories,
which clocks are inherited rather than restated, and a symptom-to-cause index.
`AGENTS.md` routes to it as required reading before authoring a transition. A
test parses the role table and compares it against what the factories build, so
a row that stops being true fails rather than misleading a reader.

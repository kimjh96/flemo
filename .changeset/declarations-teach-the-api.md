---
"@flemo/core": patch
"@flemo/react": patch
---

Document the published declarations so an editor's hover answers what the library expects. Every transition, decorator, part and morph factory input names the variant it fills, the eight built-in presets name the string they are registered under, and Router, Route, Slot, Screen, Part, Morph, Layer and the hooks carry the rules a plausible edit gets wrong: nearest-Router targeting, no per-Route transition prop, a mid-transition navigation being ignored rather than queued, the departure being cut at its end pose while the arriving side flies, shared bars handing over only on equal ids, and duration and delay inheriting where easing never does. Correct the `ACTIVE_ATTR` note, which called the attribute the screen a navigation moves to and so read backwards on every pop, and the `shared` preset note, which called it timing-free when it authors no duration but does author its curve.

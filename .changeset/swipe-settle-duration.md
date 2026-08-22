---
"@flemo/core": patch
---

Give every swipe release the length its gesture asks for. A release ran whatever duration its handler named — one number for six pixels left or three hundred — so the same navigation landed in a different time depending on whether it was swiped or tapped. The swipe controller now scales that authored duration by what is left to travel and how fast the finger was going, keeping it as the ceiling, at the one place every release write passes through: the transition's hooks, its decorator's, and its parts'. Transitions authored by consumers get it without changing a line.

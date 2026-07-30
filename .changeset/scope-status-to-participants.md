---
"@flemo/react": patch
---

Scope navigation-status updates to the screens that actually participate: parts and decorators inside a resting deep screen pin their status subscription to a constant (the screen scope already did), and a nested Router composes the enclosing screen's resting flag down so a covered outer screen's inner-active chrome pins too. One navigation now flips a depth-independent constant number of nodes (measured: 18 nodes at depth 15 before, 3 after) instead of re-rendering and re-stamping every stacked screen's decorator and parts.

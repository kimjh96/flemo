---
"@flemo/core": patch
"@flemo/react": patch
---

Keep the convergence frames light. Resting screens deeper than the transition pair no longer re-render on status flips (previously an O(depth) re-render plus attribute-write storm landed exactly on the final frames of every navigation), and the in-flight landing now presents two frames after COMPLETED instead of inside the convergence commit — with an immediate land if a new navigation starts first.

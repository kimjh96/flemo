---
"@flemo/core": minor
"@flemo/react": patch
---

Release the anim-hold of both screens of a pop together: a transition-scoped barrier (`createAnimHoldCoordinator`) waits for the pair's slowest readiness gate, so the revealed screen's image-decode wait no longer lets the exiting screen start first and the pop pair always moves on one clock, still bounded by the existing 300ms backstop. Push and replace timing is unchanged.

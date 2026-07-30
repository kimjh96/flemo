---
"@flemo/core": minor
"@flemo/react": patch
---

Split the screen-freeze decision into three modes (`computeScreenFreezeMode`): a DEEP screen (below the direct prev) freezes in the same commit that re-ranks it, only the just-covered screen's freeze keeps the quiet-window deferral, and participants wake immediately. Deferring deep freezes let a rapid push storm accumulate 15-20 live full-screen layers (no quiet window ever arrived), flickering and janking the whole app at depth — a regression introduced with the freeze deferral.

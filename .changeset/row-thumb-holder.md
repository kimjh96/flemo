---
"@flemo/web": patch
---

Hold the list row's artwork in a fixed square so its nested flight never reflows the row: staged at detail size it squeezed the title's flex slot to zero, which made the title's own flight decline and the name grow back in from the right on a pop.

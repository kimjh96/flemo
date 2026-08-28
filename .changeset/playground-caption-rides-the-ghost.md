---
"@flemo/web": patch
---

Keep the playground card's caption visible for the whole flight, as the previous playground did. Hiding it at flight start emptied the bottom third of the card on the first frame, so a 207px card collapsed to its 151px artwork and then grew, which read as the card shrinking before it grows. The caption now dissolves inside the card's ghost, and only the act's name is paired, as a `text` morph that re-typesets from the cell's label into the detail's heading while its clone holds the label's exact box.

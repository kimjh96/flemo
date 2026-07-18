---
"@flemo/core": minor
---

Suspend consumer CSS animations (pseudo-elements included) inside a navigation's cold screens — the freshly mounted entering screen and the unfreezing pop destination — starting them when the screen arrives; `<Part>` elements are exempt and the visible exiting screen is untouched. A cold first entry can mount hundreds of animated placeholder shimmer layers whose compositor commit swallows the whole transition window — measured on an iPhone as a fade presenting zero intermediate frames. With the quarantine, a first entry plays the intended transition identically to re-entries.

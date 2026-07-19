---
"@flemo/core": minor
---

Suspend consumer CSS animations (pseudo-elements included) inside a navigation's freshly mounted entering screen (push/replace), starting them when the screen arrives; `<Part>` elements are exempt, and the visible exiting screen and the pop destination are untouched (a pop destination's animations restart at the unfreeze commit under the flight's own motion). A cold first entry can mount hundreds of animated placeholder shimmer layers whose compositor commit swallows the whole transition window — measured on an iPhone as a fade presenting zero intermediate frames. With the quarantine, a first entry plays the intended transition identically to re-entries.

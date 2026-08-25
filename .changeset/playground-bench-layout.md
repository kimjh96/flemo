---
"@flemo/web": patch
---

Rebuild the playground as one small app that composes the library instead of listing it. The frame now holds a Router whose tab screens share a pinned bottom bar, a nested Router inside one of those tabs with a stack and a shared top bar of its own, a `<Part>` living outside the Slot that still runs on the flight's clock, a step that opens a panel without stacking a screen, `replace` that swaps a screen in place, and two morph hops in a row — a card into a page, then its artwork into the whole frame. Each Router prints its own path, status and depth under the frame, so "nested" is something you watch rather than something the copy claims. The transition and shared-element switches drive the inner stack; the page is in the site header, in both locales, and the fixture screens take the site's theme.

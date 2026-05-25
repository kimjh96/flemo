---
"@flemo/web": patch
---

Add three sub-tabs (Player / Up Next / Lyrics) to the NowPlaying screen, driven by `useStep`. Tab switches use `replaceStep` so the screen stays mounted and only `useParams()` updates; the Player tab also exposes a "Show album details" button that uses `pushStep` to open an expandable detail pane, with a paired `popStep` to close it. The header Close button switches from `navigate.pop` to `popStep` so it transparently unwinds any step state before crossing the screen boundary. First playground surface that exercises every useStep verb.

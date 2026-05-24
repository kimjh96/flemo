---
"@flemo/web": minor
---

Rebuild the playground from scratch around a minimal music-player demo: Library / Search tabs with a shared mini-player + tab-bar (`sharedNavigationBar`), Album detail with track list, and a Now Playing screen reached via `<LayoutScreen>` + `<LayoutConfig>` that morphs the album artwork from the source. Below the phone frame, a toggle panel swaps the Library → Album push transition (layout / cupertino / material / none) and toggles the shared bar so the difference is felt directly. The previous commerce demo is removed in favor of standalone, embed-friendly screen and bar units that can be lifted into individual docs pages in a later pass.

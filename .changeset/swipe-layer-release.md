---
"@flemo/core": patch
---

Hand a committed swipe's layer promotion back. The gesture promoted the screens it dragged and only released them when it was cancelled, so every swipe-back left `will-change: transform` on the screen it revealed and never took it off, because the engine's own release runs under a different owner. That kept the screen a containing block at rest, which trapped a consumer's `position: fixed` overlay inside the screen box and under the shared bars.

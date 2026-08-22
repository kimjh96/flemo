---
"@flemo/core": patch
---

Make a swipe-back as cheap per frame as a transition is. The gesture promoted its riding bars only, so both full-screen scopes and the dim were repainted from scratch on every frame the finger moved, and it ran the whole follow — both screens, the bars, the dim and every `<Part>` — on every pointer move rather than once per frame. Both now match what a flight already does; the release still settles from the finger's last real position.

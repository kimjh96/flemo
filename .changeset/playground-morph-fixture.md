---
"@flemo/web": patch
---

Add a morph playground at `/[lang]/playground`: one gallery-to-detail pair mounted under each screen transition, so a shared element can be judged full size on a production build instead of through a half-covered card in the landing hero. Give the music demo's album art a shared `layoutId` as well. Give the detail screen a `detail-content` part transition so its header and body copy arrive with the morph rather than beside it, and let the `sheet` case cover the screen edge to edge. Add a `zoom` entry that changes exactly one variable against `sheet` — the morph's `carry: "screen"` — so the container transform can be judged against its absence. The part transition is authored with `createRawPartTransition` so the dismissing screen's copy leaves on its own short clock instead of holding the navigation open at rest.

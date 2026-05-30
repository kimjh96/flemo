---
"@flemo/web": minor
---

Add seven custom playground transitions, selectable from the transition picker. Four are pure `createTransition` demos — `zoom` (cross-zoom dive), `card-stack` (iOS sheet present with a receding backdrop), `reveal` (clip-path iris that opens to just cover the viewport), and `spring` (overshooting bounce). Three more pair a custom `createDecorator` layer with the transition, where the decorator itself animates: `ember` (a warm radial glow blooms outward via `scale`), `pulse` (a bright ring radiates out via `scale`, sonar-style), and `beam` (a cool wedge of light swings in an arc across the backdrop via `rotate`, lighthouse-style).

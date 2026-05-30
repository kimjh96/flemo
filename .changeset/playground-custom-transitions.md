---
"@flemo/web": minor
---

Add seven custom playground transitions, selectable from the transition picker. Four are pure `createTransition` demos — `zoom` (cross-zoom dive), `card-stack` (iOS sheet present with a receding backdrop), `reveal` (clip-path iris that opens to just cover the viewport), and `spring` (overshooting bounce). Three more pair a custom `createDecorator` layer with the transition, where the decorator itself animates: `ember` (a scale-in while a warm radial glow blooms via `scale`), `aurora` (a rise while a multi-color gradient drifts across the backdrop via `backgroundPosition`), and `pulse` (a bright ring that radiates outward via `scale`, sonar-style).

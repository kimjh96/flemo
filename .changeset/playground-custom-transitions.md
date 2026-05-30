---
"@flemo/web": minor
---

Add seven custom playground transitions, selectable from the transition picker. Four are pure `createTransition` demos — `zoom` (cross-zoom dive), `card-stack` (iOS sheet present with a receding backdrop), `reveal` (clip-path iris that opens to just cover the viewport), and `spring` (overshooting bounce). Three more combine a custom `createDecorator` layer applied to the backgrounding screen: `drawer` (cupertino-style slide with a brand-blue tint), `shine` (a soft lift while a diagonal sheen sweeps across the backdrop — the decorator animates `backgroundPosition`), and `ember` (a scale-in while a warm radial glow blooms behind — the decorator animates `scale`).

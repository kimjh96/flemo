---
"@flemo/core": patch
---

Keep channels that never interpolate out of the compiled keyframes. A property
authored with the same value on both ends of a variant — the overlay
decorator's dim colour, a transition's constant edge shadow — is now applied by
the variant's own rule instead, so the keyframes name only what actually
animates. Engines drop a whole animation to the main thread when a keyframe
mentions a property they cannot composite, which showed up on Android as a dim
that lagged and stuttered while the screens slid smoothly.

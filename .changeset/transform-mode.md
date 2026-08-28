---
"@flemo/core": minor
---

Add mode: "transform" to morph transitions: the container flight is staged at destination geometry inside a clipping window and travels wholly by compositor transforms — sampled inverse-scale keyframes hold the contents at natural size, nested pairs ride as transforms, and the flight, its ghost and its camera all resolve on one clock. No built-in preset defaults to it: a transform flight scales type instead of re-typesetting it, and the zoom preset keeps the re-typesetting look.

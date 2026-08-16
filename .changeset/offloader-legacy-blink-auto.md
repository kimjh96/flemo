---
"@flemo/core": minor
"@flemo/react": minor
---

Scope the image-decode offloader to legacy Android Blink instead of running it on every device. A touch Chromium that ships no UA-CH brands (device-confirmed Galaxy Note 9 Samsung Internet) is confidently pre-2021, GPU-starved hardware whose oversized-image decode stalls the transition opening on re-entry; the offloader now auto-engages there and downscales only its genuinely oversized `<img>` sources. Modern devices (which ship UA-CH brands) and iOS are excluded, so a flagship is never touched, and `flemo:imgoffload` still overrides both ways (`on` forces it anywhere, `off` opts a legacy device out). Exposes `isLegacyAndroidBlink` from `@flemo/core`.

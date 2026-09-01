---
"@flemo/core": patch
---

Stop giving a `Part` its own compositing layer. Safari presented that layer at the part's static opacity while the animation ran, so a departing part held full colour through the flight and was cut at the end instead of fading.

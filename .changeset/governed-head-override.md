---
"@flemo/core": patch
"@flemo/devtools": patch
---

Add `flemo:governed`, an override for the governed head kit on touch Blink. The kit is armed by a browser-age probe, so a modern-but-weak phone — a 2022 foldable on a current Chrome — falls straight through it with no way to try it. The key arms or disarms it per session so a device can be measured instead of argued about.

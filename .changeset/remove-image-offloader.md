---
"@flemo/core": minor
"@flemo/react": patch
"@flemo/devtools": patch
---

Remove the image decode offloader. It rewrote oversized `<img>` sources to
downscaled blobs off the main thread, and a device round found it a net LOSS
where it engaged — the probe, the hold and the re-encode cost more than the
decode they avoided. Its auto-gate was also selecting the wrong thing: keying on
the absence of UA-CH brands identifies an old browser, not slow hardware. The
fix for an oversized original is to serve it at the size it is displayed.

Gone with it: `ensureImageDecodeOffloader`, `createImageDecodeOffloader`,
`shouldOffloadImage`, `OVERSIZE_AREA_RATIO`, `OFFLOADED_SRC_ATTR`,
`isLegacyAndroidBlink`, and the `flemo:imgoffload` flag. `@flemo/core` drops
2.7 KB gzipped.

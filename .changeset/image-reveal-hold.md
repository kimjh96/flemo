---
"@flemo/core": patch
---

Add an opt-in image reveal hold (`flemo:imghold=on`) — the `<img>` analog of the response hold. During a flight, an entering screen's still-loading images are held invisible and revealed in one batch at rest, so an image that completes over the network mid-slide can't re-raster the sliding layer and starve the animation. Image decoding still proceeds during the hold, so the reveal is a cheap composite in the quiet window rather than a mid-flight raster. Off by default while it's verified on-device.

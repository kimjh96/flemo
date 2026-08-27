---
"@flemo/web": patch
---

Add the overlay-layering fixture to the playground: a nested Router under a shared tab bar, with a bottom sheet that renders either inside the screen or through `<Layer>`. An e2e spec drives it in a browser and pins which one covers the bar — at rest and mid-flight — because jsdom does no layout or paint and could never see it.

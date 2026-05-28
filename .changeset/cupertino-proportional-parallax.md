---
"@flemo/core": patch
---

Make the cupertino transition's outgoing-screen parallax viewport-proportional. The previous screen now slides to `-30%` of the viewport width (matching iOS), instead of a fixed `-100px` that looked negligible on wide viewports and appeared to lag behind the incoming screen.

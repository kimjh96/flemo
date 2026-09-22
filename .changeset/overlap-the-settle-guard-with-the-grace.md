---
"@flemo/core": patch
---

Let the settle gate's raster guard count the frames the grace already rode. The guard proves the thread is quiet at the release and the grace is frames going by, so collecting the whole pair again afterwards serialised two waits that overlap. It now completes the evidence with one observed frame instead of two, and falls back to the full pair when a block starts in the gap it could not see.

---
"@flemo/react": minor
---

Close the release race that intermittently froze flights mid-motion on desktop Chrome: the hold release now reconciles React state in the same task as the readiness rAF (flushSync), so an interleaved commit can no longer write the stale paused hold attribute over a running animation. The render-settle gate also arms on a pop's returning screen (its landing-storm commits are node-light and slipped the mount-sized threshold), and a covered screen's Activity freeze is debounced past the natural browse rhythm so a quick detail-and-back never pays the hide/unhide raster thrash mid-flight.

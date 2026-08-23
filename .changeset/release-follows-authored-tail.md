---
"@flemo/core": patch
---

Give a swipe release the time the authored curve itself spends on the stretch that is left. The length came from `authored duration x fraction remaining`, which is the time a constant-rate motion would need — and a front-loaded transition curve is slowest exactly where a release lands. Released with 30% of the screen left, cupertino's button-driven pop covers that stretch in 0.550s where the release took 0.210s, and the gap widens the closer to the end the finger let go.

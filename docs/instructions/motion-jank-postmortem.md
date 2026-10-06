# Postmortem: the 2026-07/08 motion-jank campaigns

This regression-prevention record summarizes months of testing on desktop Chrome and Safari, iPhone Safari including Low Power Mode, Galaxy Note 9, and Pixel 9. The campaigns produced the current engine (PR #240, #251, #252, #256, #258) and a falsification map.

For a new report, read the symptom taxonomy and debugging checklist, then consult the DO-NOT-RETRY list before designing a fix. This is historical evidence; current code and `docs/architecture/*` define present behavior.

## Contents

- [(a) Symptom taxonomy](motion-jank-postmortem/symptom-taxonomy.md)
- [(b) Layered final attributions](motion-jank-postmortem/layered-attributions.md)
- [(c) DO-NOT-RETRY list](motion-jank-postmortem/do-not-retry.md)
- [(d) Worked example: the desktop player blank (#256 → #259)](motion-jank-postmortem/desktop-player-blank.md)
- [(e) Debugging checklist for the next report](motion-jank-postmortem/debugging-checklist.md)
- [Addendum — 2026-08-17 evening: attribution re-verified live](motion-jank-postmortem/addendum-2026-08-17.md)
- [Addendum 2 — 2026-08-18 live glass campaign, instrument traps, final attribution](motion-jank-postmortem/glass-campaign-2026-08-18.md)
- [2026-08-30: long-content reveal block on iOS Safari](motion-jank-postmortem/long-content-reveal-block-2026-08-30.md)

---
"@flemo/core": minor
---

Land the arrival hold at rest on every tier, and promote the screen layer on
desktop Safari too. The hold's release commit no longer lands in the motion's
sub-pixel tail — the placement that measured as a skipped-frame-class gap on
essentially every push — so content becomes visible just after the transition
instead of just before it ends. The layer promotion, meanwhile, was reaching
touch WebKit and desktop Chrome but not desktop Safari, with nothing in its
reasoning to justify the gap.

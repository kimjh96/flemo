---
"@flemo/web": patch
---

Make the playground panel-title scrub read as continuous under slow swipes: the travel grows to 18px and the recovery compresses into the drag's first 60%, so the title advances about one pixel per 13px of drag instead of one per 39px.

---
"@flemo/core": patch
---

Pair a shared element against its captured snapshot even when the leaving screen has not yet re-rendered its transitional status. A fast pop's container morph could otherwise find its partner only in the snapshot, on a screen still reading COMPLETED, be refused, and leave its camera unstarted and its children flying as bare morphs — the intermittent zoom swallow with blinking text.

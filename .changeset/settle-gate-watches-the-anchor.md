---
"@flemo/core": patch
"@flemo/react": patch
---

Start the render-settle gate watching with the transition instead of after its paint anchor, so a pop's Activity unfreeze is seen by the gate that exists to keep it out of the motion. Drop the mount grace for screens that are not mounting, which removes about 50ms of frozen flight from every pop.

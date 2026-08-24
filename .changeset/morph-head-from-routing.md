---
"@flemo/core": patch
---

Read a flight's head kit from the routing rather than from the root's attribute. The engine announces which head kit a session plays by stamping an attribute on the document root, and it stamps it from the same commit a morph is staged in — after the morph, because React runs a descendant's layout effect first. So a morph read the previous flight's answer: right by luck from the second navigation on, and wrong on the first, which started the element 33ms ahead of the screen carrying it and then aligned every push after it. That is what made the mismatch intermittent. The head decision is now one exported function that the engine's routing and the morph runtime both call, so there is no ordering left to lose.

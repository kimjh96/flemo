---
"@flemo/core": patch
---

End a nested morph's size interpolation on the element's rest size, measured at registration, rather than on the staged measurement. Staged is taken inside a container still at its from-box, and when the container's width interpolates the child is laid out slightly small there: the flight froze short of the page and snapped the difference at the landing, and the same error ran the pop. A binding registers child-first, so registration sees the natural arrival layout, and the flight now lands exactly on it in both directions.

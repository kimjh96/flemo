---
"@flemo/core": patch
---

Keep a morph's leading inside one step of the grid its engine puts lines on. Both engines floor the half-leading, and an interpolation only holds its endpoint from the instant the flight lands, so a line whose arrival half-leading sits on a step rendered one down for the whole flight and dropped there at the landing. The grid is not assumed: whole CSS pixels and device pixels are both tried, the one that reproduces what both ends actually rendered is used, and the correction stands down when neither does.

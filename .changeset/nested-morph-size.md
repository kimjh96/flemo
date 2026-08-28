---
"@flemo/core": patch
---

Carry a nested morph's own size, the other half of the from-pose correction. Riding sizes the child through the container's width interpolation, and that works only when the width actually interpolates: a container that starts at destination width, such as a full-width list row becoming a page, lays the child out full-size on the first frame, and a 48px thumbnail spread into a full-width strip at the tap instead of growing. The nested flight now interpolates the element's own width and height from the measured from-size to its size in the staged container, which is exact at both ends and silent for containers whose width does the carrying.

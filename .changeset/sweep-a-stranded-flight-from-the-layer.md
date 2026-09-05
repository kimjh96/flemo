---
"@flemo/core": patch
---

Sweep a role-bearing element left stranded in the flight layer at the start of every navigation. An interrupted storm (a tab switch tearing a screen down mid-flight) could leave a hoisted morph in the layer forever, and because a role-bearing element reads as a partner already in the air, it swallowed the camera and blinked the text on every pop after it.

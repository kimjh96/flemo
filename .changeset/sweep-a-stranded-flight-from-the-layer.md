---
"@flemo/core": patch
---

Never pair a pop against a morph left stranded in the flight layer, and sweep such corpses at the start of every navigation. An interrupted storm (a tab switch tearing a screen down mid-flight) could leave a hoisted morph in the layer with its role still set; a role-bearing element with no owning screen read as a partner already in the air, so every subsequent pop paired against it instead of the grid, swallowing the camera and blinking the text until reload.

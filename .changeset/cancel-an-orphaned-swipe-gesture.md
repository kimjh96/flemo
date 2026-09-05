---
"@flemo/react": patch
---

Cancel a swipe gesture's staged morph flights when a new drag begins over an un-settled one. A gesture torn down mid-drag (its screen frozen, the OS taking the pointer) left its flights held in the layer with their backstops suspended, and every pop after it paired against those stranded elements instead of the grid, swallowing the camera and blinking the text until reload.

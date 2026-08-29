---
"@flemo/core": minor
---

Measure a drag's progress against the screen it drags, not the window. A decorator's and a part's swipe hooks now receive the gesture's own progress as the 0 to 100 they are documented to take, supplied by the controller rather than by whichever transition happens to be running, so a dim inside a nested Router follows the finger instead of crawling. `cupertino` maps its own progress and its commit threshold against the same box; a transition that passes a second argument to `onProgress` still compiles, but that argument is no longer read.

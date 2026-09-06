---
"@flemo/core": patch
"@flemo/react": minor
---

Drive the screens flemo owns on every follow frame, even when the transition's `onMove` never calls `onProgress`. A hook written beside a declared destination owns only what it animates itself, and the screens it never touches were sitting at rest for the whole drag. Re-export `SwipeOptions`, `SwipeStop`, `SwipeInfo`, `DEFAULT_COMMIT_FRACTION` and `DEFAULT_COMMIT_VELOCITY` from `@flemo/react`, which is what a consumer installs.

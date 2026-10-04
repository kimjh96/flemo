---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/devtools": minor
---

Rename the "flight" vocabulary to "transition" everywhere. A Part that waits for the screen transition now takes `after: "transition"`, `resolveDecoratorClock` is `resolveDecoratorTiming`, and devtools exports `attachTransitionRecorder`, `TransitionRecord` and the other `Transition*` names, with reports on schema v4 (`transitions[]`, `morphs.moved`, `endAudit`). Messages, warnings and declaration docs use the same plain words as flemo.dev.

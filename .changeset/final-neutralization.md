---
"@flemo/core": minor
"@flemo/react": patch
---

Finish the framework-neutralization pass: `resolveTransition` (name → registered transition with the `none` fallback) and `subscribeStepParamsRestore` (step-frame param restore on back/forward) move into `@flemo/core`, and the React binding delegates to them. No behavior change.

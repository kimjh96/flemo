---
"@flemo/react": minor
---

`useStep` now works outside a `<Screen>`, so persistent UI like a header menu or a sidebar can drive a history-backed step that the Back button closes. Pass the param type for inference (`useStep<{ menu: boolean }>()`); inside a `<Screen>` it behaves exactly as before.

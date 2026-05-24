---
"@flemo/react": minor
---

Fix consecutive `pop()` / `popStep()` calls running out of order. All screen navigation (`push`, `replace`, `pop`) and step navigation (`pushStep`, `replaceStep`, `popStep`) now serialize onto a single ordered queue and execute strictly in call order. Previously `pop()` and `popStep()` fired `window.history.back()` directly, which let the browser coalesce rapid back-traversals into one `popstate` and desync the stack.

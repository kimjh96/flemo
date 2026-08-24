---
"@flemo/core": major
"@flemo/react": major
---

Remove the `layoutId` navigation option. It was threaded from `push()` and `replace()` through the history frame, the browser's history state, the popstate bridge and the screen context, and nothing ever read it — shared elements are paired by the `layoutId` prop on `<Morph>`, which is a different thing entirely. Passing it to `push`/`replace` is now a type error; delete the argument.

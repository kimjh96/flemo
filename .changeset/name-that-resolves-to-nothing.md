---
"@flemo/core": patch
---

Say in development when a name resolves to nothing. A transition, part
transition, decorator or morph transition that was never registered used to fall
back to something inert and report nothing, so a typo or a forgotten `<Router>`
entry produced an element that sits perfectly still while the DOM says
everything is right. Each unregistered name is now reported once, on the console,
with what it fell back to and where to register it. Production builds are
unchanged: the diagnostic folds away with `process.env.NODE_ENV`.

---
"@flemo/core": patch
"@flemo/react": patch
---

Hand a morph's ownership to the runtime instead of stamping it on every element. The binding marked each `<Morph>` with the status and active flag of the screen it belongs to, and both change on every navigation, so every morph on the page had two attributes rewritten each time one happened and every one of those subtrees had its style invalidated. Measured on the playground's zoom bench, whose list carries thirty-three of them, the pop's camera juddered as it converged on Safari and stopped the moment the two writes did. The values are only ever read where the DOM cannot answer for itself, which is shared chrome rendered outside its own screen, so the runtime now writes them there and nowhere else.

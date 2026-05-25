---
"@flemo/web": patch
---

Make `harmonized` the default playground transition: cupertino for browse-deeper hops (Library / Search → Album) and material for the player (which closes with a downward chevron, so push and dismiss share one vertical axis). The transition picker now groups options as Default / Built-in / Custom — `blur` lives in Custom so it's clearly authored in the playground, not shipped from @flemo/core. Force-override any preset with a single click; the code peek shows the resolver rule when harmonized, or the `createTransition` source when forced.

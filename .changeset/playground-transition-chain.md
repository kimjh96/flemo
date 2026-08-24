---
"@flemo/web": patch
---

Add a transition-chain fixture under the morph playground: one stack, five pushes, a different transition on each — cupertino, a `zoom` morph, material, a consumer-authored `drift`, and `layout` with a shared morph. The strip above it answers whether a transition works; this answers the question only a stack can, which is whether a morph flight leaves anything behind for the next transition to trip on and whether five pops unwind five different transitions in the right order — and it runs NESTED, inside a screen of an outer Router, so the chain covers that axis too. Both morph steps pair the artwork inside the card as well as the card itself, and carry the same heading at both ends, so the contents grow with the card instead of being covered by the ghost's cross-fade, and everything unpaired on a morph screen arrives on a `<Part>` rather than appearing the moment its screen does.

---
"@flemo/web": patch
---

Unify the Korean docs voice to 해요체. The `layout-screen.ko.mdx` page mixed `~합니다` / `~입니다` (formal polite) with `~해요` / `~이에요` (informal polite) sentence endings on a per-paragraph basis; every other Korean docs page was already 해요체 throughout. Converted all 32 occurrences to 해요체 across `layout-screen.ko.mdx` and one straggler in `screen.ko.mdx`, including the headings that quote a hypothetical user's complaint ("모프가 일어나지 않고 페이드만 됩니다" → "...페이드만 돼요" etc.) so the voice stays consistent on every line.

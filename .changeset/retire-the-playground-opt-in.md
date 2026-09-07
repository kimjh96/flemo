---
"@flemo/devtools": patch
---

Retire `flemo:devtools`, the playground's `?devtools=on` opt-in. Nothing has
read or written it since `<FlemoDevtools />` began mounting unconditionally, so
it is moved to the retired list and a session still carrying it is reported as
residue rather than as a live flag.

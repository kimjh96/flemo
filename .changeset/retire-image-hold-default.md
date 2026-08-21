---
"@flemo/core": patch
---

Retire the image reveal hold's automatic default. It shipped on for the
steady-60 desktop profile; a desktop A/B rotating it per push/pop pair — on a
session with images genuinely completing mid-flight — was judged
indistinguishable, and a touch round the same week measured it as a net loss
(fewer hitches in the flight, more at the landing, because parking the paint
parks the decode with it). `flemo:imghold=on` still arms it for a consumer whose
own measurement asks for it.

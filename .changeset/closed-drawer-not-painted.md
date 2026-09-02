---
"@flemo/web": patch
---

Stop painting the docs navigation drawer while it is closed. It stayed in the paint tree behind an off-screen transform, which cost a 462ms main-thread block on every mobile entry into the docs.

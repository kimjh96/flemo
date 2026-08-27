---
"@flemo/web": minor
---

Remove the playground page and every route under it. It was rebuilt without first establishing which transition and shared-element combinations flemo actually supports, and repeated patching did not converge. The composition rules will be read out of the library before anything replaces it.

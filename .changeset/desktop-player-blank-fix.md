---
"@flemo/core": patch
---

Fix the COMPLETED cleanup leaving a stale pose on the landed screen: when another inline lease survived the flip (the governed easing stamp), the entering screen could stay parked at its from-pose — on a raf-pinned desktop session this presented as a fully blank viewport after a push→pop→push re-entry. The landed scope's transform/opacity are now stripped explicitly at COMPLETED, and the raf force pin can pierce the desktop compiled gate again for diagnostics (default desktop routing is unchanged).

---
"@flemo/core": patch
---

Track the engine's architecture map. `packages/core/docs/motion-engine.md` describes the
compiled-tier design as it stands, and a test holds its module inventory to the code —
every module named must exist, every module under `core/engine/`, `platform/` and `dom/`
must be named. The previous version of that map sat untracked for a release cycle and
ended up describing a motion driver and two modules that had been deleted.

Source comments no longer cite documents that are not in the repository.

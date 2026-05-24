---
"@flemo/core": minor
---

Initial release of `@flemo/core` — flemo's framework-agnostic primitives. Contains the navigation queue (`TaskManger`), history + navigate zustand stores, the self-pop guard, the transition + decorator factories with built-in presets (`cupertino`, `material`, `layout`, `none`, `overlay`), the CSS keyframes compiler, and pure utilities (`isServer`, `getParams`, `getMatchedPathPattern`, `findScrollable`). No React or Motion runtime dependency — animation target types are defined locally. `@flemo/react` depends on it; consumers who only need transition primitives can install `@flemo/core` directly.

---
"@flemo/react": minor
---

Initial release of `@flemo/react` — the React bindings for flemo, replacing the previous `flemo` npm package. Contains `Router`, `Route`, `Screen`, `ScreenMotion`, `ScreenDecorator`, `ScreenFreeze`, `LayoutScreen`, `LayoutConfig`, the `useNavigate` / `useStep` / `useScreen` / `useParams` hooks, the `HistoryListener`, the `Renderer`, and the `useTransitionStyles` insertion-effect hook that injects the compiled keyframes. Depends on `@flemo/core` for framework-agnostic primitives. Motion remains a peer dependency for `LayoutScreen` (`AnimatePresence`) and `LayoutConfig` (`MotionConfig`); both are targeted for `@flemo/layout` in a future major. Migration: anywhere you wrote `import { ... } from "flemo"` becomes `import { ... } from "@flemo/react"`, and `declare module "flemo"` becomes `declare module "@flemo/react"`.

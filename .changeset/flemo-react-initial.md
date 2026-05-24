---
"@flemo/react": minor
---

Initial release of `@flemo/react` — the React bindings for flemo, replacing the previous `flemo` npm package. Contains `Router`, `Route`, `Screen`, `ScreenMotion`, `ScreenDecorator`, `ScreenFreeze`, the `useNavigate` / `useStep` / `useScreen` / `useParams` hooks, the `HistoryListener`, the `Renderer`, and the `useTransitionStyles` insertion-effect hook that injects the compiled keyframes. Depends on `@flemo/core` for framework-agnostic primitives — no motion peer dependency. Migration: anywhere you wrote `import { ... } from "flemo"` becomes `import { ... } from "@flemo/react"`, and `declare module "flemo"` becomes `declare module "@flemo/react"`. `LayoutScreen` and `LayoutConfig` moved to the new `@flemo/layout` package — install it (`pnpm add @flemo/layout motion`) only if you use `layoutId`-based shared-element morphs.

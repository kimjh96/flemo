---
"@flemo/react": minor
---

Initial release of `@flemo/react` — flemo's React layer extracted from the main `flemo` package. Contains `Router`, `Route`, `Screen`, `ScreenMotion`, `ScreenDecorator`, `ScreenFreeze`, `LayoutScreen`, `LayoutConfig`, the `useNavigate` / `useStep` / `useScreen` / `useParams` hooks, the `HistoryListener`, the `Renderer`, and the `useTransitionStyles` insertion-effect hook that injects the compiled keyframes. Depends on `@flemo/core` for primitives, keeps `motion` as a peer dependency for `LayoutScreen` (`AnimatePresence`) and `LayoutConfig` (`MotionConfig`) — both planned to move to `@flemo/layout` in a future major.

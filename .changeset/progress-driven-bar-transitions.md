---
"@flemo/core": minor
"@flemo/react": minor
"@flemo/web": patch
---

Add progress-driven bar transitions. `createBarTransition` defines a named, status×active animation for a single bar child (any CSS property), and `<BarTransition name="...">` runs it on a specific element inside any app or navigation bar — shared or not. Programmatic transitions play on the compositor with no React re-render, and the same definition follows the swipe-back drag inline. Register the transitions through the `Router`'s `barTransitions` prop.

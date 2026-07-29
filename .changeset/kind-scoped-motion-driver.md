---
"@flemo/core": minor
---

Choose the motion driver per transition kind, measured from the authored keyframes: a transition whose screens move fast (peak translation ≥ 6 CSS px/frame, percentages resolved against the real screen box) runs on the native compiled-CSS clock even on engines that default to the rAF player, while fades, drifts, and unanalyzable choreographies keep the player. One navigation always runs on one driver, and a new `driver: "native" | "player"` transition option lets authors override the measurement.

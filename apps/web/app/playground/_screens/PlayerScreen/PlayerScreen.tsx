"use client";

import { Screen, type ScreenProps } from "@flemo/react";

// Playground demos render inside a phone-frame `div`, not a real device, so
// no actual safe-area insets apply. Forcing `"0px"` keeps `<Screen>`'s
// internal `position: fixed` shared bars anchored to the bottom of the
// viewport (without this they fall back to their static position and end up
// at the top of the frame).
//
// `backgroundColor` is bound to `--color-surface` so the screen scope tracks
// the shiflo light/dark token instead of defaulting to a hardcoded white.
// Otherwise the scope stays white in dark mode while the inner bars use the
// dark surface token, creating a visible mismatch.
function PlayerScreen(props: ScreenProps) {
  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-surface)"
      {...props}
    />
  );
}

export default PlayerScreen;

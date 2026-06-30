"use client";

import { Screen, type ScreenProps } from "@flemo/react";

// Wraps <Screen> for the music mini-app. Like the wallet demo it runs inside a
// glass bezel, not a real device, so force 0px chrome insets to keep any shared
// bar anchored to the bottom of the region.
function MusicScreen(props: ScreenProps) {
  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      {...props}
    />
  );
}

export default MusicScreen;

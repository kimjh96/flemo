"use client";

import { Screen, type ScreenProps } from "@flemo/react";

// Every screen in the fixture goes through here.
//
// The bars are the reason. A <Screen> reserves room for a device's status bar
// and system navigation bar, and a shared bar anchors itself INSIDE those
// insets — so in a region that is not a device (this frame, an embedded
// preview) a bottom bar with the default insets falls back to the top of the
// region, which is exactly where it does not belong. Zeroing both insets
// anchors it to the bottom of whatever box the app was given.
//
// The same note is on the wallet demo's wrapper, which is where this was
// learned the first time.
function StageScreen(props: ScreenProps) {
  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      {...props}
    />
  );
}

export default StageScreen;

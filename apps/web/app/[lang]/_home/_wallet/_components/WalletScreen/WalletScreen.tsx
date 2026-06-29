"use client";

import { Screen, type ScreenProps } from "@flemo/react";

// Wraps <Screen> for the wallet demo. The demo runs inside the glass bezel, not
// a real device, so force 0px chrome insets, this keeps any shared bars
// anchored to the bottom of the region instead of falling back to the top.
// The background is solid (the app stays opaque; only the bezel is glass).
function WalletScreen(props: ScreenProps) {
  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      {...props}
    />
  );
}

export default WalletScreen;

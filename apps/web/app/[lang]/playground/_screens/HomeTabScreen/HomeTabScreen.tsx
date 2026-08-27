"use client";

import { Screen } from "@flemo/react";

import TabBar from "../../_components/TabBar";

import BrowseRouter from "../../_router/BrowseRouter";

// The Home tab: a screen of the app's stack that contains a whole Router of its
// own.
//
// That nesting is the arrangement a real tabbed app has, and it is why a push
// inside this tab deepens a stack the tab bar knows nothing about. It declares
// no bar itself — the listings header belongs to the Router inside it, and the
// tab bar belongs to the Router outside it, so this screen is exactly the seam
// between two levels of chrome and owns neither.
//
// Both insets are zeroed because this region is not a device. A <Screen>
// reserves room for a status bar and a system navigation bar, and inside an
// embedded frame those reservations put a bottom bar at the TOP of the region.
// A real app passes the device's own insets here.
function HomeTabScreen() {
  return (
    <Screen
      statusBarHeight="0px"
      systemNavigationBarHeight="0px"
      backgroundColor="var(--color-bg)"
      sharedBottomBar={<TabBar />}
      sharedBottomBarId="tabs"
    >
      <BrowseRouter />
    </Screen>
  );
}

export default HomeTabScreen;

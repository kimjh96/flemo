"use client";

import StageScreen from "../../_components/StageScreen";
import TabBar from "../../_components/TabBar";

import BrowseRouter from "../../_router/BrowseRouter";

// A tab that is a whole app of its own.
//
// The screen itself renders nothing but the shared tab bar and a Router: the
// stack inside it is where the pushes happen, and the bar underneath belongs to
// this level. `contentScrollable={false}` because the nested Router manages its
// own scrolling per screen; letting both scroll gives the frame two scrollbars
// and a nested stack that drifts under its own chrome.
function BrowseTab() {
  return (
    <StageScreen
      backgroundColor="var(--color-bg)"
      sharedBottomBarId="tabs"
      sharedBottomBar={<TabBar />}
      contentScrollable={false}
    >
      <BrowseRouter />
    </StageScreen>
  );
}

export default BrowseTab;

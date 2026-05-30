"use client";

import { Screen, type ScreenProps } from "@flemo/react";

import usePlaygroundSettingsStore from "@/app/playground/_stores/usePlaygroundSettingsStore";

// Wrapper around `<Screen>` shared by every music screen. The chrome values
// come from the playground settings store (Screen chrome card) so users can
// drive `statusBar*` / `systemNavigationBar*` / `backgroundColor` /
// `hideStatusBar` / `contentScrollable` live.
//
// The store defaults reproduce the prior hardcoded behavior exactly:
// `statusBarHeight` / `systemNavigationBarHeight` default to `"0px"` because
// these demos render inside a phone-frame `div`, not a real device — no
// safe-area insets apply, and `"0px"` keeps `<Screen>`'s `position: fixed`
// shared bars anchored to the bottom of the viewport (otherwise they fall
// back to their static position at the top of the frame). `backgroundColor`
// defaults to `--color-surface` so the screen scope tracks the shiflo
// light/dark token instead of a hardcoded white.
//
// Raising the bar heights inserts inset spacers inside the frame, shrinking
// the content area — that's the intended demo, though the frame doesn't
// emulate a real notch, so colored bands just render as plain strips.
//
// `{...props}` spreads last so a screen passing an explicit prop (appBar,
// sharedNavigationBar, children) still wins over these defaults.
function PlayerScreen(props: ScreenProps) {
  const chrome = usePlaygroundSettingsStore((state) => state.chrome);

  return (
    <Screen
      statusBarHeight={chrome.statusBarHeight}
      statusBarColor={chrome.statusBarColor || undefined}
      systemNavigationBarHeight={chrome.systemNavigationBarHeight}
      systemNavigationBarColor={chrome.systemNavigationBarColor || undefined}
      backgroundColor={chrome.backgroundColor}
      hideStatusBar={chrome.hideStatusBar}
      contentScrollable={chrome.contentScrollable}
      {...props}
    />
  );
}

export default PlayerScreen;

"use client";

import { create } from "zustand";

// `null` is the natural state: each push site uses the transition that fits
// its own navigation context (cupertino for browse-deeper hops, material for
// the player). Setting a value here overrides every push to use that one
// transition, exposed as a playground knob to compare behaviors.
export type PushTransitionOverride = "cupertino" | "material" | "blur" | "none";

// The Screen chrome knobs, mirroring `ScreenProps`. Heights/colors are CSS
// strings so they thread straight into `<Screen>`. The defaults below
// reproduce the playground's prior hardcoded behavior exactly — so embedded
// mode (panel hidden, store untouched) and the existing visual baseline are
// unchanged until a knob is moved.
export interface ScreenChromeSettings {
  statusBarHeight: string;
  statusBarColor: string;
  systemNavigationBarHeight: string;
  systemNavigationBarColor: string;
  backgroundColor: string;
  hideStatusBar: boolean;
  contentScrollable: boolean;
}

export const defaultChrome: ScreenChromeSettings = {
  statusBarHeight: "0px",
  statusBarColor: "",
  systemNavigationBarHeight: "0px",
  systemNavigationBarColor: "",
  backgroundColor: "var(--color-surface)",
  hideStatusBar: false,
  contentScrollable: true
};

interface PlaygroundSettingsState {
  pushTransitionOverride: PushTransitionOverride | null;
  // The mini-player + tab bar, passed to screens as `sharedNavigationBar`.
  showMiniPlayer: boolean;
  // The Library header, passed as `sharedAppBar`. Only Library declares one,
  // so this toggle gates that single shared bar.
  showSharedAppBar: boolean;
  chrome: ScreenChromeSettings;
  setPushTransitionOverride: (value: PushTransitionOverride | null) => void;
  setShowMiniPlayer: (value: boolean) => void;
  setShowSharedAppBar: (value: boolean) => void;
  setChrome: (patch: Partial<ScreenChromeSettings>) => void;
  resetChrome: () => void;
}

const usePlaygroundSettingsStore = create<PlaygroundSettingsState>((set) => ({
  pushTransitionOverride: null,
  showMiniPlayer: true,
  showSharedAppBar: true,
  chrome: defaultChrome,
  setPushTransitionOverride: (value) => set({ pushTransitionOverride: value }),
  setShowMiniPlayer: (value) => set({ showMiniPlayer: value }),
  setShowSharedAppBar: (value) => set({ showSharedAppBar: value }),
  setChrome: (patch) => set((state) => ({ chrome: { ...state.chrome, ...patch } })),
  resetChrome: () => set({ chrome: defaultChrome })
}));

export default usePlaygroundSettingsStore;

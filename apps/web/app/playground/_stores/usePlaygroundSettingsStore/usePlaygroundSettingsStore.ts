"use client";

import { create } from "zustand";

// `null` is the natural state: each push site uses the transition that fits
// its own navigation context (cupertino for browse-deeper hops, material for
// the player). Setting a value here overrides every push to use that one
// transition, exposed as a playground knob to compare behaviors.
export type PushTransitionOverride =
  | "cupertino"
  | "material"
  | "blur"
  | "zoom"
  | "card-stack"
  | "reveal"
  | "spring"
  | "ember"
  | "pulse"
  | "focus"
  | "none";

interface PlaygroundSettingsState {
  pushTransitionOverride: PushTransitionOverride | null;
  // The mini-player + tab bar, passed to screens as `sharedNavigationBar`.
  showMiniPlayer: boolean;
  // The Library header, passed as `sharedAppBar`. Only Library declares one,
  // so this toggle gates that single shared bar.
  showSharedAppBar: boolean;
  setPushTransitionOverride: (value: PushTransitionOverride | null) => void;
  setShowMiniPlayer: (value: boolean) => void;
  setShowSharedAppBar: (value: boolean) => void;
}

const usePlaygroundSettingsStore = create<PlaygroundSettingsState>((set) => ({
  pushTransitionOverride: null,
  showMiniPlayer: true,
  showSharedAppBar: true,
  setPushTransitionOverride: (value) => set({ pushTransitionOverride: value }),
  setShowMiniPlayer: (value) => set({ showMiniPlayer: value }),
  setShowSharedAppBar: (value) => set({ showSharedAppBar: value })
}));

export default usePlaygroundSettingsStore;

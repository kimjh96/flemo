"use client";

import { create } from "zustand";

// `null` is the natural state: each push site uses the transition that fits
// its own navigation context (cupertino for browse-deeper hops, material for
// the player). Setting a value here overrides every push to use that one
// transition, exposed as a playground knob to compare behaviors.
export type PushTransitionOverride = "cupertino" | "material" | "blur" | "none";

interface PlaygroundSettingsState {
  pushTransitionOverride: PushTransitionOverride | null;
  showMiniPlayer: boolean;
  setPushTransitionOverride: (value: PushTransitionOverride | null) => void;
  setShowMiniPlayer: (value: boolean) => void;
}

const usePlaygroundSettingsStore = create<PlaygroundSettingsState>((set) => ({
  pushTransitionOverride: null,
  showMiniPlayer: true,
  setPushTransitionOverride: (value) => set({ pushTransitionOverride: value }),
  setShowMiniPlayer: (value) => set({ showMiniPlayer: value })
}));

export default usePlaygroundSettingsStore;

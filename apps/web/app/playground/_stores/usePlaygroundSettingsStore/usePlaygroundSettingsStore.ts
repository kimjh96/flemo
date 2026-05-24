"use client";

import { create } from "zustand";

export type PushTransition = "cupertino" | "material" | "blur" | "none";

interface PlaygroundSettingsState {
  pushTransition: PushTransition;
  showMiniPlayer: boolean;
  setPushTransition: (value: PushTransition) => void;
  setShowMiniPlayer: (value: boolean) => void;
}

const usePlaygroundSettingsStore = create<PlaygroundSettingsState>((set) => ({
  pushTransition: "cupertino",
  showMiniPlayer: true,
  setPushTransition: (value) => set({ pushTransition: value }),
  setShowMiniPlayer: (value) => set({ showMiniPlayer: value })
}));

export default usePlaygroundSettingsStore;

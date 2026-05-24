"use client";

import { create } from "zustand";

import { albums, type Track } from "@/app/playground/_data/albums";

interface PlayerState {
  currentTrack: Track;
  isPlaying: boolean;
  setTrack: (track: Track) => void;
  togglePlay: () => void;
}

const defaultTrack = albums[0]!.tracks[0]!;

const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: defaultTrack,
  isPlaying: true,
  setTrack: (track) => set({ currentTrack: track, isPlaying: true }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying }))
}));

export default usePlayerStore;

import { create } from "zustand";

interface ScreenStore {
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
  setDragStatus: (dragStatus: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (replaceTransitionStatus: "IDLE" | "PENDING") => void;
}

const useScreenStore = create<ScreenStore>((set) => ({
  dragStatus: "IDLE",
  replaceTransitionStatus: "IDLE",
  setDragStatus: (dragStatus) => set({ dragStatus }),
  setReplaceTransitionStatus: (replaceTransitionStatus) => set({ replaceTransitionStatus })
}));

export default useScreenStore;

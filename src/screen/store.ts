import { create } from "zustand";

interface ScreenStore {
  transitionStatus: "IDLE" | "PENDING";
  setTransitionStatus: (transitionStatus: "IDLE" | "PENDING") => void;
}

const useScreenStore = create<ScreenStore>((set) => ({
  transitionStatus: "IDLE",
  setTransitionStatus: (transitionStatus) => set({ transitionStatus })
}));

export default useScreenStore;

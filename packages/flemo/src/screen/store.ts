import { create } from "zustand";

export interface SharedBarPresence {
  appBar: boolean;
  navigationBar: boolean;
}

interface ScreenStore {
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
  sharedBars: Record<string, SharedBarPresence>;
  setDragStatus: (dragStatus: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (replaceTransitionStatus: "IDLE" | "PENDING") => void;
  registerSharedBars: (id: string, presence: SharedBarPresence) => void;
  unregisterSharedBars: (id: string) => void;
}

const useScreenStore = create<ScreenStore>((set) => ({
  dragStatus: "IDLE",
  replaceTransitionStatus: "IDLE",
  sharedBars: {},
  setDragStatus: (dragStatus) => set({ dragStatus }),
  setReplaceTransitionStatus: (replaceTransitionStatus) => set({ replaceTransitionStatus }),
  registerSharedBars: (id, presence) =>
    set((state) => ({ sharedBars: { ...state.sharedBars, [id]: presence } })),
  unregisterSharedBars: (id) =>
    set((state) => {
      const sharedBars = { ...state.sharedBars };
      delete sharedBars[id];
      return { sharedBars };
    })
}));

export default useScreenStore;

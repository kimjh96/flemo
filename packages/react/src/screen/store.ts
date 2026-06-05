import { createStore, type StoreApi } from "zustand/vanilla";

export interface SharedBarPresence {
  appBar: boolean;
  navigationBar: boolean;
}

export interface ScreenStore {
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
  sharedBars: Record<string, SharedBarPresence>;
  setDragStatus: (dragStatus: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (replaceTransitionStatus: "IDLE" | "PENDING") => void;
  registerSharedBars: (id: string, presence: SharedBarPresence) => void;
  unregisterSharedBars: (id: string) => void;
}

export type ScreenStoreApi = StoreApi<ScreenStore>;

// Request-scoped (see @flemo/core history/store.ts) — created per Router mount.
export default function createScreenStore(): ScreenStoreApi {
  return createStore<ScreenStore>((set) => ({
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
}

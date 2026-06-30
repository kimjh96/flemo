import { createStore, type StoreApi } from "zustand/vanilla";

export interface SharedBarPresence {
  topBar: boolean;
  bottomBar: boolean;
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

// Request-scoped (see history/store.ts, navigate/store.ts), created per Router
// mount. Holds transition-UI state (drag / replace status) and the shared-bar
// registry the swipe controller and bar-riding read. Framework-neutral.
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

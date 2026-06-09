import { createStore, type StoreApi } from "zustand/vanilla";

export type NavigateStatus = "IDLE" | "PUSHING" | "REPLACING" | "POPPING" | "COMPLETED";

export interface NavigateStore {
  status: NavigateStatus;
  transitionTaskId: string | null;
  setStatus: (status: NavigateStatus) => void;
  setTransitionTaskId: (transitionTaskId: string | null) => void;
}

export type NavigateStoreApi = StoreApi<NavigateStore>;

// Request-scoped (see history/store.ts) — created per Router mount.
export default function createNavigateStore(): NavigateStoreApi {
  return createStore<NavigateStore>((set) => ({
    status: "IDLE",
    transitionTaskId: null,
    setStatus: (status) => set({ status }),
    setTransitionTaskId: (transitionTaskId) => set({ transitionTaskId })
  }));
}

import { createStore, type StoreApi } from "zustand/vanilla";

export type NavigateStatus = "IDLE" | "PUSHING" | "REPLACING" | "POPPING" | "COMPLETED";

// The statuses during which a flight is actually moving. Several places need
// this exact set — the engine's routing, the image offloader's "is a
// transition running" check, the GPU prewarm's deferral, devtools' flight
// reconstruction — and each used to spell it out, so adding a status meant
// finding every copy.
export const TRANSITIONAL_STATUS_VALUES = ["PUSHING", "POPPING", "REPLACING"] as const;

export interface NavigateStore {
  status: NavigateStatus;
  transitionTaskId: string | null;
  setStatus: (status: NavigateStatus) => void;
  setTransitionTaskId: (transitionTaskId: string | null) => void;
}

export type NavigateStoreApi = StoreApi<NavigateStore>;

// Request-scoped (see history/store.ts), created per Router mount.
export default function createNavigateStore(): NavigateStoreApi {
  return createStore<NavigateStore>((set) => ({
    status: "IDLE",
    transitionTaskId: null,
    setStatus: (status) => set({ status }),
    setTransitionTaskId: (transitionTaskId) => set({ transitionTaskId })
  }));
}

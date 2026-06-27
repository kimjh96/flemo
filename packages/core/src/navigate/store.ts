import { createStore, type StoreApi } from "zustand/vanilla";

import type { TransitionName } from "@transition/typing";

export type NavigateStatus = "IDLE" | "PUSHING" | "REPLACING" | "POPPING" | "COMPLETED";

// Marks the navigation currently being driven through the View Transitions
// snapshot path (non-composited transitions). While `active`, bindings give the
// entering / leaving screen scopes a `view-transition-name` so the browser
// animates their snapshots; the CSS-keyframe path is skipped (status stays at
// rest, never PUSHING/REPLACING/POPPING).
export interface ViewTransitionState {
  active: boolean;
  transitionName: TransitionName | null;
}

export interface NavigateStore {
  status: NavigateStatus;
  transitionTaskId: string | null;
  viewTransition: ViewTransitionState;
  setStatus: (status: NavigateStatus) => void;
  setTransitionTaskId: (transitionTaskId: string | null) => void;
  setViewTransition: (viewTransition: ViewTransitionState) => void;
}

export type NavigateStoreApi = StoreApi<NavigateStore>;

// Request-scoped (see history/store.ts), created per Router mount.
export default function createNavigateStore(): NavigateStoreApi {
  return createStore<NavigateStore>((set) => ({
    status: "IDLE",
    transitionTaskId: null,
    viewTransition: { active: false, transitionName: null },
    setStatus: (status) => set({ status }),
    setTransitionTaskId: (transitionTaskId) => set({ transitionTaskId }),
    setViewTransition: (viewTransition) => set({ viewTransition })
  }));
}

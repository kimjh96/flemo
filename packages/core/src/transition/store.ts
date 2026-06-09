import { createStore, type StoreApi } from "zustand/vanilla";

import type { TransitionName } from "@transition/typing";

export interface TransitionStore {
  defaultTransitionName: TransitionName;
  setDefaultTransitionName: (defaultTransitionName: TransitionName) => void;
}

export type TransitionStoreApi = StoreApi<TransitionStore>;

// Request-scoped (see history/store.ts), created per Router mount, seeded with its
// defaultTransitionName. The compiled-transition registries (transitionMap/decoratorMap) stay
// global: they're name-keyed, idempotent, and not request state.
export default function createTransitionStore(
  defaultTransitionName: TransitionName = "cupertino"
): TransitionStoreApi {
  return createStore<TransitionStore>((set) => ({
    defaultTransitionName,
    setDefaultTransitionName: (defaultTransitionName) => set({ defaultTransitionName })
  }));
}

import { createContext } from "react";

import type { HistoryStoreApi, NavigateStoreApi, TransitionStoreApi } from "@flemo/core";

import type { ScreenStoreApi } from "@screen/store";

// The request-scoped store bundle. Router creates one per mount and provides it here so every
// consumer (renderer, navigation hooks, screen runtime) reads the same per-request instances,
// no module-level singletons shared across SSR requests.
export interface FlemoStores {
  history: HistoryStoreApi;
  navigate: NavigateStoreApi;
  transition: TransitionStoreApi;
  screen: ScreenStoreApi;
}

const StoreContext = createContext<FlemoStores | null>(null);

export default StoreContext;

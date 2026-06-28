import { createContext } from "react";

import type {
  HistoryDriver,
  HistoryStoreApi,
  NavigateStoreApi,
  TransitionStoreApi
} from "@flemo/core";

import type { ScreenStoreApi } from "@screen/store";

// The request-scoped store bundle. Router creates one per mount and provides it here so every
// consumer (renderer, navigation hooks, screen runtime) reads the same per-request instances,
// no module-level singletons shared across SSR requests.
export interface FlemoStores {
  history: HistoryStoreApi;
  navigate: NavigateStoreApi;
  transition: TransitionStoreApi;
  screen: ScreenStoreApi;
  // The history backend for this Router scope: the browser History API for a
  // root <Router>, an in-memory stack for a nested one. Shared by the navigation
  // controller and the history sync so both drive the same history.
  driver: HistoryDriver;
  // Self-pop guard mark for this scope: the global guard for a root <Router>, a
  // no-op for a nested one (which has no global history sync to coordinate with).
  markSelfInduced: () => void;
}

const StoreContext = createContext<FlemoStores | null>(null);

export default StoreContext;

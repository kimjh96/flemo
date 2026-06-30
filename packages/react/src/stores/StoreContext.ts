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
  // Self-pop guard for this scope. A browser <Router> creates its own guard
  // instance: `markSelfInduced` (injected into the navigation controller) marks a
  // flemo-induced traversal, and `consume` (injected into the history sync) skips
  // it. A memory <Router> uses a no-op mark and a never-true consume.
  markSelfInduced: () => void;
  consume: () => boolean;
}

const StoreContext = createContext<FlemoStores | null>(null);

export default StoreContext;

import { type PropsWithChildren } from "react";

import {
  consumeSelfInducedPop,
  createBrowserHistoryDriver,
  createHistoryStore,
  createNavigateStore,
  createTransitionStore,
  markSelfInducedPop
} from "@flemo/core";

import createScreenStore from "@screen/store";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Test helper: a fresh, isolated request-scoped store bundle plus a Provider wrapper, so hooks
// and components under test resolve the same per-test instances they would inside <Router>.
export function createTestStores(): FlemoStores {
  return {
    history: createHistoryStore(),
    navigate: createNavigateStore(),
    transition: createTransitionStore(),
    screen: createScreenStore(),
    driver: createBrowserHistoryDriver(),
    markSelfInduced: markSelfInducedPop,
    consume: consumeSelfInducedPop
  };
}

export function storesWrapper(stores: FlemoStores) {
  return function StoresWrapper({ children }: PropsWithChildren) {
    return <StoreContext.Provider value={stores}>{children}</StoreContext.Provider>;
  };
}

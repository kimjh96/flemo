import { useContext } from "react";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Imperative access to the request-scoped stores (for task-queue callbacks and event handlers
// that run outside React render). Reactive reads should use the per-store hooks instead.
export default function useStores(): FlemoStores {
  const stores = useContext(StoreContext);

  if (!stores) {
    throw new Error("flemo stores are missing — render inside a <Router>.");
  }

  return stores;
}

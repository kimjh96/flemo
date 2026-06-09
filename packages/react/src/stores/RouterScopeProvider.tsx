import { useState, type PropsWithChildren } from "react";

import { createHistoryStore, createNavigateStore, createTransitionStore } from "@flemo/core";

import createScreenStore from "@screen/store";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// Hosts the request-scoped store bundle ABOVE a <Router>, so siblings rendered outside the Router
// — a devtools/inspector panel beside the screen frame, a navigation card driving it — can read
// and drive the same stores. The Router, when it finds this scope as an ancestor, adopts and
// seeds this bundle instead of creating its own private one. Without it, the Router owns its
// stores privately and only its descendants (the screens) can reach them.
function RouterScopeProvider({ children }: PropsWithChildren) {
  const [stores] = useState<FlemoStores>(() => ({
    history: createHistoryStore(),
    navigate: createNavigateStore(),
    transition: createTransitionStore(),
    screen: createScreenStore()
  }));

  return <StoreContext.Provider value={stores}>{children}</StoreContext.Provider>;
}

export default RouterScopeProvider;

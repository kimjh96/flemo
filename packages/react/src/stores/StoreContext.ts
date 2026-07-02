import { createContext } from "react";

import type { FlemoStores } from "@flemo/core";

// The request-scoped store bundle (see @flemo/core's FlemoStores /
// createRouterScope). Router creates one per mount and provides it here so
// every consumer (renderer, navigation hooks, screen runtime) reads the same
// per-request instances — no module-level singletons shared across SSR
// requests. Re-exported so existing `@stores/StoreContext` import sites keep
// working.
export type { FlemoStores };

const StoreContext = createContext<FlemoStores | null>(null);

export default StoreContext;

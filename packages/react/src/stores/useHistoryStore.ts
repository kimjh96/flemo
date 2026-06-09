import { useStore } from "zustand";

import type { HistoryStore } from "@flemo/core";

import useStores from "@stores/useStores";

// Reactive read of the request-scoped history store. The server snapshot is the store's seeded
// initial state (root frame from initPath), so this renders on the server too.
export default function useHistoryStore<T>(selector: (state: HistoryStore) => T): T {
  return useStore(useStores().history, selector);
}

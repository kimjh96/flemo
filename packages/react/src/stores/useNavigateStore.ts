import { useStore } from "zustand";

import type { NavigateStore } from "@flemo/core";

import useStores from "@stores/useStores";

export default function useNavigateStore<T>(selector: (state: NavigateStore) => T): T {
  return useStore(useStores().navigate, selector);
}

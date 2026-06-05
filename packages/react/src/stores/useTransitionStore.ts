import { useStore } from "zustand";

import type { TransitionStore } from "@flemo/core";

import useStores from "@stores/useStores";

export default function useTransitionStore<T>(selector: (state: TransitionStore) => T): T {
  return useStore(useStores().transition, selector);
}

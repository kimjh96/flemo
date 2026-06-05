import { useStore } from "zustand";

import type { ScreenStore } from "@screen/store";

import useStores from "@stores/useStores";

export default function useScreenStore<T>(selector: (state: ScreenStore) => T): T {
  return useStore(useStores().screen, selector);
}

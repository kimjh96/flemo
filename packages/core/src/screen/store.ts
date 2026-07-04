import { createStore, type StoreApi } from "zustand/vanilla";

export interface SharedBarPresence {
  topBar: boolean;
  bottomBar: boolean;
}

// What a screen's scope SURFACE looks like to the screen beneath it. A prev
// screen entering on pop may pre-raster by parking at its destination during
// the anim-hold window, but ONLY when the screen covering it is opaque —
// otherwise the park would shine through. Registered from the live scope's
// computed style so CSS variables and theme switches resolve correctly.
export interface ScreenSurface {
  opaqueBackground: boolean;
}

export interface ScreenStore {
  dragStatus: "IDLE" | "PENDING";
  replaceTransitionStatus: "IDLE" | "PENDING";
  sharedBars: Record<string, SharedBarPresence>;
  screenSurfaces: Record<string, ScreenSurface>;
  setDragStatus: (dragStatus: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (replaceTransitionStatus: "IDLE" | "PENDING") => void;
  registerSharedBars: (id: string, presence: SharedBarPresence) => void;
  unregisterSharedBars: (id: string) => void;
  registerScreenSurface: (id: string, surface: ScreenSurface) => void;
  unregisterScreenSurface: (id: string) => void;
}

export type ScreenStoreApi = StoreApi<ScreenStore>;

// Request-scoped (see history/store.ts, navigate/store.ts), created per Router
// mount. Holds transition-UI state (drag / replace status) and the shared-bar
// registry the swipe controller and bar-riding read. Framework-neutral.
export default function createScreenStore(): ScreenStoreApi {
  return createStore<ScreenStore>((set) => ({
    dragStatus: "IDLE",
    replaceTransitionStatus: "IDLE",
    sharedBars: {},
    screenSurfaces: {},
    setDragStatus: (dragStatus) => set({ dragStatus }),
    setReplaceTransitionStatus: (replaceTransitionStatus) => set({ replaceTransitionStatus }),
    registerSharedBars: (id, presence) =>
      set((state) => ({ sharedBars: { ...state.sharedBars, [id]: presence } })),
    unregisterSharedBars: (id) =>
      set((state) => {
        const sharedBars = { ...state.sharedBars };
        delete sharedBars[id];
        return { sharedBars };
      }),
    registerScreenSurface: (id, surface) =>
      set((state) => {
        const current = state.screenSurfaces[id];
        // Idempotent on value: transition-start refreshes re-measure every
        // status flip, and an unchanged surface must not trigger re-renders.
        if (current && current.opaqueBackground === surface.opaqueBackground) return state;
        return { screenSurfaces: { ...state.screenSurfaces, [id]: surface } };
      }),
    unregisterScreenSurface: (id) =>
      set((state) => {
        const screenSurfaces = { ...state.screenSurfaces };
        delete screenSurfaces[id];
        return { screenSurfaces };
      })
  }));
}

import { createStore, type StoreApi } from "zustand/vanilla";

export interface SharedBarPresence {
  topBar: boolean;
  bottomBar: boolean;
}

export type SharedBarId = string | number;

export interface SharedBarMetadata {
  id?: SharedBarId;
  height?: number;
}

export interface SharedBarsMetadata {
  topBar?: SharedBarMetadata;
  bottomBar?: SharedBarMetadata;
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
  sharedBarMetadata: Record<string, SharedBarsMetadata>;
  screenSurfaces: Record<string, ScreenSurface>;
  setDragStatus: (dragStatus: "IDLE" | "PENDING") => void;
  setReplaceTransitionStatus: (replaceTransitionStatus: "IDLE" | "PENDING") => void;
  registerSharedBars: (
    id: string,
    presence: SharedBarPresence,
    metadata?: SharedBarsMetadata
  ) => void;
  updateSharedBarHeight: (id: string, position: keyof SharedBarsMetadata, height: number) => void;
  unregisterSharedBars: (id: string) => void;
  registerScreenSurface: (id: string, surface: ScreenSurface) => void;
  unregisterScreenSurface: (id: string) => void;
}

export type ScreenStoreApi = StoreApi<ScreenStore>;

const mergeRegisteredBarMetadata = (
  next: SharedBarMetadata | undefined,
  current: SharedBarMetadata | undefined
): SharedBarMetadata | undefined => {
  if (!next) return undefined;
  if (next.height !== undefined || next.id !== current?.id) return next;
  return { ...next, height: current?.height };
};

// Request-scoped (see history/store.ts, navigate/store.ts), created per Router
// mount. Holds transition-UI state (drag / replace status) and the shared-bar
// registry the swipe controller and bar-riding read. Framework-neutral.
export default function createScreenStore(): ScreenStoreApi {
  return createStore<ScreenStore>((set) => ({
    dragStatus: "IDLE",
    replaceTransitionStatus: "IDLE",
    sharedBars: {},
    sharedBarMetadata: {},
    screenSurfaces: {},
    setDragStatus: (dragStatus) => set({ dragStatus }),
    setReplaceTransitionStatus: (replaceTransitionStatus) => set({ replaceTransitionStatus }),
    registerSharedBars: (id, presence, metadata) =>
      set((state) => {
        const declaredMetadata =
          metadata ??
          ({
            topBar: presence.topBar ? {} : undefined,
            bottomBar: presence.bottomBar ? {} : undefined
          } satisfies SharedBarsMetadata);
        const currentPresence = state.sharedBars[id];
        const currentMetadata = state.sharedBarMetadata[id];
        // Activity reconnects registration effects. A declaration carries the
        // bar identity, not a request to erase its last real measurement: keep
        // the height only while the identity is unchanged. A replacement bar
        // must measure itself instead of inheriting unrelated layout.
        const nextMetadata = {
          topBar: mergeRegisteredBarMetadata(declaredMetadata.topBar, currentMetadata?.topBar),
          bottomBar: mergeRegisteredBarMetadata(
            declaredMetadata.bottomBar,
            currentMetadata?.bottomBar
          )
        } satisfies SharedBarsMetadata;
        const samePresence =
          currentPresence?.topBar === presence.topBar &&
          currentPresence?.bottomBar === presence.bottomBar;
        const sameMetadata =
          currentMetadata?.topBar?.id === nextMetadata.topBar?.id &&
          currentMetadata?.topBar?.height === nextMetadata.topBar?.height &&
          currentMetadata?.bottomBar?.id === nextMetadata.bottomBar?.id &&
          currentMetadata?.bottomBar?.height === nextMetadata.bottomBar?.height &&
          !!currentMetadata?.topBar === !!nextMetadata.topBar &&
          !!currentMetadata?.bottomBar === !!nextMetadata.bottomBar;
        if (samePresence && sameMetadata) return state;
        return {
          sharedBars: { ...state.sharedBars, [id]: presence },
          sharedBarMetadata: { ...state.sharedBarMetadata, [id]: nextMetadata }
        };
      }),
    updateSharedBarHeight: (id, position, height) =>
      set((state) => {
        if (height <= 0) return state;
        const bars = state.sharedBarMetadata[id];
        const bar = bars?.[position];
        if (!bars || !bar || bar.height === height) return state;
        return {
          sharedBarMetadata: {
            ...state.sharedBarMetadata,
            [id]: { ...bars, [position]: { ...bar, height } }
          }
        };
      }),
    unregisterSharedBars: (id) =>
      set((state) => {
        const sharedBars = { ...state.sharedBars };
        const sharedBarMetadata = { ...state.sharedBarMetadata };
        delete sharedBars[id];
        delete sharedBarMetadata[id];
        return { sharedBars, sharedBarMetadata };
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

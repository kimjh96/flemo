import { describe, expect, it } from "vitest";

import createScreenStore from "@screen/store";

describe("screen store: screenSurfaces registry", () => {
  it("registers and unregisters a screen's surface", () => {
    const store = createScreenStore();

    store.getState().registerScreenSurface("a", { opaqueBackground: true });
    expect(store.getState().screenSurfaces.a).toEqual({ opaqueBackground: true });

    store.getState().unregisterScreenSurface("a");
    expect(store.getState().screenSurfaces.a).toBeUndefined();
  });

  it("is idempotent on value so transition-start refreshes don't churn subscribers", () => {
    const store = createScreenStore();
    store.getState().registerScreenSurface("a", { opaqueBackground: true });
    const before = store.getState().screenSurfaces;

    store.getState().registerScreenSurface("a", { opaqueBackground: true });
    expect(store.getState().screenSurfaces).toBe(before); // same reference, no update

    store.getState().registerScreenSurface("a", { opaqueBackground: false });
    expect(store.getState().screenSurfaces).not.toBe(before);
    expect(store.getState().screenSurfaces.a).toEqual({ opaqueBackground: false });
  });
});

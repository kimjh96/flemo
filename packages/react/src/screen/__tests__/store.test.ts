import { beforeEach, describe, expect, it } from "vitest";

import createScreenStore, { type ScreenStoreApi } from "@screen/store";

let useScreenStore: ScreenStoreApi;

const reset = () => {
  useScreenStore = createScreenStore();
};

describe("createScreenStore: shared bar registry", () => {
  beforeEach(reset);

  it("registers a screen's shared bar presence", () => {
    useScreenStore.getState().registerSharedBars("a", { appBar: true, navigationBar: false });

    expect(useScreenStore.getState().sharedBars).toEqual({
      a: { appBar: true, navigationBar: false }
    });
  });

  it("removes an entry on unregister without touching others", () => {
    const { registerSharedBars, unregisterSharedBars } = useScreenStore.getState();

    registerSharedBars("a", { appBar: true, navigationBar: true });
    registerSharedBars("b", { appBar: false, navigationBar: true });
    unregisterSharedBars("a");

    expect(useScreenStore.getState().sharedBars).toEqual({
      b: { appBar: false, navigationBar: true }
    });
  });

  it("re-registering the same id overwrites the previous presence", () => {
    const { registerSharedBars } = useScreenStore.getState();
    registerSharedBars("a", { appBar: true, navigationBar: false });
    registerSharedBars("a", { appBar: false, navigationBar: true });
    expect(useScreenStore.getState().sharedBars.a).toEqual({
      appBar: false,
      navigationBar: true
    });
  });

  it("unregistering an unknown id is a no-op (other entries intact)", () => {
    useScreenStore.getState().registerSharedBars("a", { appBar: true, navigationBar: true });
    useScreenStore.getState().unregisterSharedBars("does-not-exist");
    expect(useScreenStore.getState().sharedBars).toEqual({
      a: { appBar: true, navigationBar: true }
    });
  });
});

describe("createScreenStore: dragStatus", () => {
  beforeEach(reset);

  it("defaults to IDLE", () => {
    expect(useScreenStore.getState().dragStatus).toBe("IDLE");
  });

  it("setDragStatus toggles between IDLE and PENDING", () => {
    useScreenStore.getState().setDragStatus("PENDING");
    expect(useScreenStore.getState().dragStatus).toBe("PENDING");
    useScreenStore.getState().setDragStatus("IDLE");
    expect(useScreenStore.getState().dragStatus).toBe("IDLE");
  });

  it("setDragStatus does not affect replaceTransitionStatus or sharedBars", () => {
    useScreenStore.setState({ replaceTransitionStatus: "PENDING" });
    useScreenStore.getState().registerSharedBars("a", { appBar: true, navigationBar: false });
    useScreenStore.getState().setDragStatus("PENDING");

    const state = useScreenStore.getState();
    expect(state.dragStatus).toBe("PENDING");
    expect(state.replaceTransitionStatus).toBe("PENDING");
    expect(state.sharedBars.a).toEqual({ appBar: true, navigationBar: false });
  });
});

describe("createScreenStore: replaceTransitionStatus", () => {
  beforeEach(reset);

  it("defaults to IDLE", () => {
    expect(useScreenStore.getState().replaceTransitionStatus).toBe("IDLE");
  });

  it("setReplaceTransitionStatus toggles between IDLE and PENDING", () => {
    useScreenStore.getState().setReplaceTransitionStatus("PENDING");
    expect(useScreenStore.getState().replaceTransitionStatus).toBe("PENDING");
    useScreenStore.getState().setReplaceTransitionStatus("IDLE");
    expect(useScreenStore.getState().replaceTransitionStatus).toBe("IDLE");
  });
});

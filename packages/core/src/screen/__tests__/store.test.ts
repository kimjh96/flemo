import { beforeEach, describe, expect, it } from "vitest";

import createScreenStore, { type ScreenStoreApi } from "@screen/store";

let useScreenStore: ScreenStoreApi;

const reset = () => {
  useScreenStore = createScreenStore();
};

describe("createScreenStore: shared bar registry", () => {
  beforeEach(reset);

  it("registers a screen's shared bar presence", () => {
    useScreenStore.getState().registerSharedBars("a", { topBar: true, bottomBar: false });

    expect(useScreenStore.getState().sharedBars).toEqual({
      a: { topBar: true, bottomBar: false }
    });
    expect(useScreenStore.getState().sharedBarMetadata).toEqual({
      a: { topBar: {}, bottomBar: undefined }
    });
  });

  it("registers bar IDs and updates measured heights without changing presence", () => {
    const { registerSharedBars, updateSharedBarHeight } = useScreenStore.getState();
    registerSharedBars(
      "builder",
      { topBar: true, bottomBar: true },
      {
        topBar: { id: "builder-header" },
        bottomBar: { id: "builder-actions" }
      }
    );

    updateSharedBarHeight("builder", "topBar", 106);
    updateSharedBarHeight("builder", "bottomBar", 81);

    expect(useScreenStore.getState().sharedBars.builder).toEqual({
      topBar: true,
      bottomBar: true
    });
    expect(useScreenStore.getState().sharedBarMetadata.builder).toEqual({
      topBar: { id: "builder-header", height: 106 },
      bottomBar: { id: "builder-actions", height: 81 }
    });
  });

  it("ignores zero measurements so a frozen bar cannot collapse its cached height", () => {
    const { registerSharedBars, updateSharedBarHeight } = useScreenStore.getState();
    registerSharedBars(
      "a",
      { topBar: true, bottomBar: false },
      { topBar: { id: "header", height: 106 } }
    );
    updateSharedBarHeight("a", "topBar", 0);
    expect(useScreenStore.getState().sharedBarMetadata.a?.topBar?.height).toBe(106);
  });

  it("removes an entry on unregister without touching others", () => {
    const { registerSharedBars, unregisterSharedBars } = useScreenStore.getState();

    registerSharedBars("a", { topBar: true, bottomBar: true });
    registerSharedBars("b", { topBar: false, bottomBar: true });
    unregisterSharedBars("a");

    expect(useScreenStore.getState().sharedBars).toEqual({
      b: { topBar: false, bottomBar: true }
    });
    expect(useScreenStore.getState().sharedBarMetadata).toEqual({
      b: { topBar: undefined, bottomBar: {} }
    });
  });

  it("re-registering the same id overwrites the previous presence", () => {
    const { registerSharedBars } = useScreenStore.getState();
    registerSharedBars("a", { topBar: true, bottomBar: false });
    registerSharedBars("a", { topBar: false, bottomBar: true });
    expect(useScreenStore.getState().sharedBars.a).toEqual({
      topBar: false,
      bottomBar: true
    });
  });

  it("unregistering an unknown id is a no-op (other entries intact)", () => {
    useScreenStore.getState().registerSharedBars("a", { topBar: true, bottomBar: true });
    useScreenStore.getState().unregisterSharedBars("does-not-exist");
    expect(useScreenStore.getState().sharedBars).toEqual({
      a: { topBar: true, bottomBar: true }
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
    useScreenStore.getState().registerSharedBars("a", { topBar: true, bottomBar: false });
    useScreenStore.getState().setDragStatus("PENDING");

    const state = useScreenStore.getState();
    expect(state.dragStatus).toBe("PENDING");
    expect(state.replaceTransitionStatus).toBe("PENDING");
    expect(state.sharedBars.a).toEqual({ topBar: true, bottomBar: false });
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

import { beforeEach, describe, expect, it } from "vitest";

import createNavigateStore, { type NavigateStoreApi } from "@navigate/store";

let store: NavigateStoreApi;

describe("createNavigateStore", () => {
  beforeEach(() => {
    store = createNavigateStore();
  });

  it("starts with status IDLE and a null transitionTaskId", () => {
    const { status, transitionTaskId } = store.getState();
    expect(status).toBe("IDLE");
    expect(transitionTaskId).toBeNull();
  });

  it("setStatus replaces the status without touching transitionTaskId", () => {
    store.setState({ transitionTaskId: "task-1" });
    store.getState().setStatus("PUSHING");

    expect(store.getState().status).toBe("PUSHING");
    expect(store.getState().transitionTaskId).toBe("task-1");
  });

  it("setStatus accepts every NavigateStatus value", () => {
    const { setStatus } = store.getState();
    for (const status of ["IDLE", "PUSHING", "REPLACING", "POPPING", "COMPLETED"] as const) {
      setStatus(status);
      expect(store.getState().status).toBe(status);
    }
  });

  it("setTransitionTaskId stores the id and accepts null to clear", () => {
    store.getState().setTransitionTaskId("abc-123");
    expect(store.getState().transitionTaskId).toBe("abc-123");

    store.getState().setTransitionTaskId(null);
    expect(store.getState().transitionTaskId).toBeNull();
  });

  it("setters are stable references across reads (zustand actions identity)", () => {
    const { setStatus: a } = store.getState();
    const { setStatus: b } = store.getState();
    expect(a).toBe(b);
  });

  it("each created store is isolated", () => {
    const other = createNavigateStore();
    store.getState().setStatus("PUSHING");
    expect(other.getState().status).toBe("IDLE");
  });
});

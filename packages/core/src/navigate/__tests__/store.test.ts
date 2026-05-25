import { beforeEach, describe, expect, it } from "vitest";

import useNavigateStore from "@navigate/store";

const reset = () => useNavigateStore.setState({ status: "IDLE", transitionTaskId: null });

describe("useNavigateStore", () => {
  beforeEach(reset);

  it("starts with status IDLE and a null transitionTaskId", () => {
    const { status, transitionTaskId } = useNavigateStore.getState();
    expect(status).toBe("IDLE");
    expect(transitionTaskId).toBeNull();
  });

  it("setStatus replaces the status without touching transitionTaskId", () => {
    useNavigateStore.setState({ transitionTaskId: "task-1" });
    useNavigateStore.getState().setStatus("PUSHING");

    expect(useNavigateStore.getState().status).toBe("PUSHING");
    expect(useNavigateStore.getState().transitionTaskId).toBe("task-1");
  });

  it("setStatus accepts every NavigateStatus value", () => {
    const { setStatus } = useNavigateStore.getState();
    for (const status of ["IDLE", "PUSHING", "REPLACING", "POPPING", "COMPLETED"] as const) {
      setStatus(status);
      expect(useNavigateStore.getState().status).toBe(status);
    }
  });

  it("setTransitionTaskId stores the id and accepts null to clear", () => {
    useNavigateStore.getState().setTransitionTaskId("abc-123");
    expect(useNavigateStore.getState().transitionTaskId).toBe("abc-123");

    useNavigateStore.getState().setTransitionTaskId(null);
    expect(useNavigateStore.getState().transitionTaskId).toBeNull();
  });

  it("setters are stable references across reads (zustand actions identity)", () => {
    const { setStatus: a } = useNavigateStore.getState();
    const { setStatus: b } = useNavigateStore.getState();
    expect(a).toBe(b);
  });
});

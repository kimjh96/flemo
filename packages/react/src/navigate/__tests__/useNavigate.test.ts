import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger, useHistoryStore, useNavigateStore } from "@flemo/core";

import useNavigate from "@navigate/useNavigate";

declare module "@Route" {
  interface RegisterRoute {
    "/": Record<string, never>;
    "/a": Record<string, never>;
    "/b": Record<string, never>;
    "/c": Record<string, never>;
    "/c-prime": Record<string, never>;
    "/album/:id": { id: string };
  }
}

// Each useNavigate call lives inside `TaskManger.addTask({ control: { manual:
// true } })` — the task pauses in MANUAL_PENDING until something calls
// resolveTask. ScreenMotion does that from `animationend` at runtime. In
// jsdom there's no animation, so a background sweeper repeatedly calls
// `resolveAllPending` to unblock each push/replace/pop in order.
const startManualGateSweeper = () => {
  let sweeping = true;
  const sweeper = (async () => {
    while (sweeping) {
      await new Promise((r) => setTimeout(r, 8));
      await TaskManger.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await sweeper;
  };
};

const resetStores = () => {
  useHistoryStore.setState({ index: -1, histories: [] });
  useNavigateStore.setState({ status: "IDLE", transitionTaskId: null });
  // Bring window.history back to a known origin so pushState/back don't
  // confuse subsequent tests.
  while (window.history.length > 1) {
    // jsdom can't actually trim history; navigate to the same path so the
    // pushState state object is reset.
    break;
  }
  window.history.replaceState(null, "", "/");
};

describe("useNavigate — push", () => {
  let stopSweeper: () => Promise<void>;
  beforeEach(() => {
    resetStores();
    stopSweeper = startManualGateSweeper();
  });
  afterEach(async () => {
    await stopSweeper();
  });

  it("adds a history entry, sets COMPLETED, and reflects the pathname in window.location", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.length).toBe(1);
    expect(histories[0]!.pathname).toBe("/a");
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
    expect(window.location.pathname).toBe("/a");
  });

  it("serializes back-to-back pushes in FIFO order", async () => {
    const { result } = renderHook(() => useNavigate());

    await Promise.all([
      result.current.push("/a"),
      result.current.push("/b"),
      result.current.push("/c")
    ]);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(2);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b", "/c"]);
  });

  it("ignores a new push while the previous one hasn't reached COMPLETED", async () => {
    const { result } = renderHook(() => useNavigate());

    // Halt the sweeper for this case so the first push stays in PUSHING.
    await stopSweeper();
    useNavigateStore.setState({ status: "PUSHING", transitionTaskId: "stuck" });

    await result.current.push("/a");
    const { histories } = useHistoryStore.getState();
    expect(histories.length).toBe(0);

    // Restart sweeper so the afterEach teardown is consistent.
    useNavigateStore.setState({ status: "COMPLETED", transitionTaskId: null });
    stopSweeper = startManualGateSweeper();
  });
});

describe("useNavigate — replace", () => {
  let stopSweeper: () => Promise<void>;
  beforeEach(() => {
    resetStores();
    stopSweeper = startManualGateSweeper();
  });
  afterEach(async () => {
    await stopSweeper();
  });

  it("swaps the current entry: push /a then replace /b leaves [/b] at index 0", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.replace("/b");

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/b"]);
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
    expect(window.location.pathname).toBe("/b");
  });

  it("serializes a push → replace → replace chain in FIFO order", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.replace("/b");
    await result.current.replace("/c");

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/c"]);
  });
});

describe("useNavigate — pop", () => {
  let stopSweeper: () => Promise<void>;
  beforeEach(() => {
    resetStores();
    stopSweeper = startManualGateSweeper();
  });
  afterEach(async () => {
    await stopSweeper();
  });

  it("is a no-op when there's nothing below the root", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.pop();

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(-1);
    expect(histories).toEqual([]);
  });

  it("removes the top entry and decrements the index", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.pop();

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
  });

  it("pop(2) skips one screen, landing two entries back in one transition", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.push("/c");
    await result.current.push("/c-prime"); // [a, b, c, c-prime] idx=3
    await result.current.pop(2);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
  });

  it("pop(3) lands three entries back", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.push("/c");
    await result.current.push("/c-prime"); // [a, b, c, c-prime] idx=3
    await result.current.pop(3);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
  });

  it("clamps to the root when count exceeds the available depth", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.push("/c"); // [a, b, c] idx=2
    await result.current.pop(99);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
  });

  it("pop(1) matches the single-step pop", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.pop(1);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
  });

  it("pop(0) and negative counts are no-ops", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b"); // [a, b] idx=1
    await result.current.pop(0);
    await result.current.pop(-2);

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });
});

describe("useNavigate — popTo", () => {
  let stopSweeper: () => Promise<void>;
  beforeEach(() => {
    resetStores();
    stopSweeper = startManualGateSweeper();
  });
  afterEach(async () => {
    await stopSweeper();
  });

  it("pops back to the nearest screen matching the route pattern", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/album/:id", { id: "1" });
    await result.current.push("/b");
    await result.current.push("/c"); // [a, album/1, b, c] idx=3

    await result.current.popTo("/album/:id");

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/album/1"]);
    expect(useNavigateStore.getState().status).toBe("COMPLETED");
  });

  it("resolves to the closest match when several screens share the pattern", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/album/:id", { id: "1" });
    await result.current.push("/album/:id", { id: "2" });
    await result.current.push("/c"); // [album/1, album/2, c] idx=2

    await result.current.popTo("/album/:id");

    // The nearer album (/album/2) wins, not the deeper /album/1.
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/album/1", "/album/2"]);
  });

  it("never targets the current top, even if it matches the pattern", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/album/:id", { id: "1" });
    await result.current.push("/b");
    await result.current.push("/album/:id", { id: "2" }); // top is also an album

    await result.current.popTo("/album/:id");

    // Skips the top album and lands on the deeper /album/1.
    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/album/1"]);
  });

  it("is a no-op when no screen below the top matches", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b"); // [a, b] idx=1, no album anywhere

    await result.current.popTo("/album/:id");

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });
});

describe("useNavigate — mixed flows", () => {
  let stopSweeper: () => Promise<void>;
  beforeEach(() => {
    resetStores();
    stopSweeper = startManualGateSweeper();
  });
  afterEach(async () => {
    await stopSweeper();
  });

  it("push /a → push /b → replace /c → pop ends with [/a] at index 0", async () => {
    const { result } = renderHook(() => useNavigate());

    await result.current.push("/a");
    await result.current.push("/b");
    await result.current.replace("/c");
    await result.current.pop();

    const { index, histories } = useHistoryStore.getState();
    expect(index).toBe(0);
    expect(histories.map((h) => h.pathname)).toEqual(["/a"]);
  });

  it("concurrent fan-out of push + replace + pop drains in arrival order", async () => {
    const { result } = renderHook(() => useNavigate());

    await Promise.all([
      result.current.push("/a"),
      result.current.push("/b"),
      result.current.push("/c"),
      result.current.replace("/c-prime"),
      result.current.pop()
    ]);

    const { index, histories } = useHistoryStore.getState();
    // push a, push b, push c → [a, b, c] idx=2
    // replace c-prime → [a, b, c-prime] idx=2
    // pop → [a, b] idx=1
    expect(index).toBe(1);
    expect(histories.map((h) => h.pathname)).toEqual(["/a", "/b"]);
  });
});

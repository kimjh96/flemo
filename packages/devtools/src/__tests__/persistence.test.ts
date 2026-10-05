import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTrace,
  loadTrace,
  MAX_PERSISTED_BYTES,
  MAX_PERSISTED_TRANSITIONS,
  saveTrace,
  TRACE_KEY
} from "../persistence";

import type { TransitionRecord } from "../types";

// A DEVELOPMENT SESSION RELOADS CONSTANTLY, and each reload used to take the
// trace with it — including the one transition the user had just watched go wrong.

const transition = (id: string, padding = 0): TransitionRecord =>
  ({ id, kind: "PUSH", durationMs: 400, note: "x".repeat(padding) }) as unknown as TransitionRecord;

beforeEach(() => {
  clearTrace();
});

afterEach(() => {
  clearTrace();
  vi.restoreAllMocks();
});

describe("carrying a trace across a page load", () => {
  it("round-trips the tail of the buffer", () => {
    saveTrace([transition("transition-1"), transition("transition-2")], "4");
    const restored = loadTrace("4");
    expect(restored?.transitions.map((entry) => entry.id)).toEqual([
      "transition-1",
      "transition-2"
    ]);
    expect(restored?.note).toContain("BEFORE the last full load");
  });

  it("keeps only the recent transitions, which are the ones anybody reads", () => {
    const many = Array.from({ length: MAX_PERSISTED_TRANSITIONS + 5 }, (_, index) =>
      transition(`transition-${index}`)
    );
    saveTrace(many, "4");
    const restored = loadTrace("4");
    expect(restored?.transitions).toHaveLength(MAX_PERSISTED_TRANSITIONS);
    expect(restored?.transitions[0].id).toBe("transition-5");
  });

  it("drops the oldest until the payload fits rather than throwing it all away", () => {
    // Two transitions, each half the ceiling on its own: only one can be kept.
    const fat = Math.round(MAX_PERSISTED_BYTES * 0.6);
    saveTrace([transition("old", fat), transition("new", fat)], "4");
    const restored = loadTrace("4");
    expect(restored?.transitions.map((entry) => entry.id)).toEqual(["new"]);
  });

  it("keeps nothing at all when even one transition is over the ceiling", () => {
    saveTrace([transition("huge", MAX_PERSISTED_BYTES * 2)], "4");
    expect(loadTrace("4")).toBeNull();
  });

  it("DROPS a trace from another schema instead of coercing it", () => {
    saveTrace([transition("transition-1")], "2");
    expect(loadTrace("4")).toBeNull();
    // ...and clears it, so the next load is not asked the same question again.
    expect(sessionStorage.getItem(TRACE_KEY)).toBeNull();
  });

  it("drops an unreadable payload rather than failing the attach", () => {
    sessionStorage.setItem(TRACE_KEY, "{not json");
    expect(loadTrace("4")).toBeNull();
    expect(sessionStorage.getItem(TRACE_KEY)).toBeNull();
  });

  it("drops a payload whose transitions are not a list", () => {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify({ version: "4", transitions: "nope" }));
    expect(loadTrace("4")).toBeNull();
  });

  it("reports an empty saved time rather than inventing one", () => {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify({ version: "4", transitions: [] }));
    expect(loadTrace("4")?.savedAt).toBe("");
  });

  it("returns nothing when there is nothing stored", () => {
    expect(loadTrace("4")).toBeNull();
  });

  it("survives a storage that refuses to be written", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveTrace([transition("transition-1")], "3")).not.toThrow();
    setItem.mockRestore();
  });

  // Replaced wholesale rather than spied on `Storage.prototype`: under Node's
  // experimental global storage this session's `sessionStorage` is not a
  // `Storage` instance at all, so a prototype spy silently does nothing and
  // the case passes without reaching the path it names.
  it("survives a storage that refuses to be read", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        length: 0,
        key: () => null,
        setItem: () => {},
        removeItem: () => {},
        getItem: () => {
          throw new Error("denied");
        }
      }
    });
    try {
      expect(loadTrace("4")).toBeNull();
    } finally {
      if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    }
  });

  it("survives a storage that refuses to be cleared", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => clearTrace()).not.toThrow();
    removeItem.mockRestore();
  });

  it("survives a document with no session storage to reach at all", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() {
        throw new Error("partitioned");
      }
    });
    try {
      expect(loadTrace("4")).toBeNull();
      expect(() => saveTrace([transition("transition-1")], "3")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    }
  });

  it("drops a payload that parses to nothing", () => {
    sessionStorage.setItem(TRACE_KEY, "null");
    expect(loadTrace("4")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTrace,
  loadTrace,
  MAX_PERSISTED_BYTES,
  MAX_PERSISTED_FLIGHTS,
  saveTrace,
  TRACE_KEY
} from "../persistence";

import type { FlightRecord } from "../types";

// A DEVELOPMENT SESSION RELOADS CONSTANTLY, and each reload used to take the
// trace with it — including the one flight the user had just watched go wrong.

const flight = (id: string, padding = 0): FlightRecord =>
  ({ id, kind: "PUSH", durationMs: 400, note: "x".repeat(padding) }) as unknown as FlightRecord;

beforeEach(() => {
  clearTrace();
});

afterEach(() => {
  clearTrace();
  vi.restoreAllMocks();
});

describe("carrying a trace across a page load", () => {
  it("round-trips the tail of the buffer", () => {
    saveTrace([flight("flight-1"), flight("flight-2")], "3");
    const restored = loadTrace("3");
    expect(restored?.flights.map((entry) => entry.id)).toEqual(["flight-1", "flight-2"]);
    expect(restored?.note).toContain("BEFORE the last full load");
  });

  it("keeps only the recent flights, which are the ones anybody reads", () => {
    const many = Array.from({ length: MAX_PERSISTED_FLIGHTS + 5 }, (_, index) =>
      flight(`flight-${index}`)
    );
    saveTrace(many, "3");
    const restored = loadTrace("3");
    expect(restored?.flights).toHaveLength(MAX_PERSISTED_FLIGHTS);
    expect(restored?.flights[0].id).toBe("flight-5");
  });

  it("drops the oldest until the payload fits rather than throwing it all away", () => {
    // Two flights, each half the ceiling on its own: only one can be kept.
    const fat = Math.round(MAX_PERSISTED_BYTES * 0.6);
    saveTrace([flight("old", fat), flight("new", fat)], "3");
    const restored = loadTrace("3");
    expect(restored?.flights.map((entry) => entry.id)).toEqual(["new"]);
  });

  it("keeps nothing at all when even one flight is over the ceiling", () => {
    saveTrace([flight("huge", MAX_PERSISTED_BYTES * 2)], "3");
    expect(loadTrace("3")).toBeNull();
  });

  it("DROPS a trace from another schema instead of coercing it", () => {
    saveTrace([flight("flight-1")], "2");
    expect(loadTrace("3")).toBeNull();
    // ...and clears it, so the next load is not asked the same question again.
    expect(sessionStorage.getItem(TRACE_KEY)).toBeNull();
  });

  it("drops an unreadable payload rather than failing the attach", () => {
    sessionStorage.setItem(TRACE_KEY, "{not json");
    expect(loadTrace("3")).toBeNull();
    expect(sessionStorage.getItem(TRACE_KEY)).toBeNull();
  });

  it("drops a payload whose flights are not a list", () => {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify({ version: "3", flights: "nope" }));
    expect(loadTrace("3")).toBeNull();
  });

  it("reports an empty saved time rather than inventing one", () => {
    sessionStorage.setItem(TRACE_KEY, JSON.stringify({ version: "3", flights: [] }));
    expect(loadTrace("3")?.savedAt).toBe("");
  });

  it("returns nothing when there is nothing stored", () => {
    expect(loadTrace("3")).toBeNull();
  });

  it("survives a storage that refuses to be written", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => saveTrace([flight("flight-1")], "3")).not.toThrow();
    setItem.mockRestore();
  });

  it("survives a storage that refuses to be read", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadTrace("3")).toBeNull();
    getItem.mockRestore();
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
      expect(loadTrace("3")).toBeNull();
      expect(() => saveTrace([flight("flight-1")], "3")).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    }
  });

  it("drops a payload that parses to nothing", () => {
    sessionStorage.setItem(TRACE_KEY, "null");
    expect(loadTrace("3")).toBeNull();
  });
});

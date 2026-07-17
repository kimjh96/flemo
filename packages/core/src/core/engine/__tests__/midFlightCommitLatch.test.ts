import { describe, expect, it } from "vitest";

import { createMidFlightCommitLatch } from "@core/engine/midFlightCommitLatch";

describe("createMidFlightCommitLatch", () => {
  it("arms and reads back the same task id", () => {
    const latch = createMidFlightCommitLatch();
    expect(latch.isArmed("task-1")).toBe(false);
    latch.arm("task-1");
    expect(latch.isArmed("task-1")).toBe(true);
  });

  it("is armed for the armed task ONLY — no other task id reads as armed", () => {
    const latch = createMidFlightCommitLatch();
    latch.arm("task-1");
    // The passive side of a DIFFERENT transition must never see task-1's arm.
    expect(latch.isArmed("task-2")).toBe(false);
    expect(latch.isArmed("task-1")).toBe(true);
  });

  it("disarms only when the id matches (COMPLETED of the armed transition)", () => {
    const latch = createMidFlightCommitLatch();
    latch.arm("task-1");
    // A COMPLETED for a different id leaves the slot intact.
    latch.disarm("task-other");
    expect(latch.isArmed("task-1")).toBe(true);
    // The matching COMPLETED clears it.
    latch.disarm("task-1");
    expect(latch.isArmed("task-1")).toBe(false);
  });

  it("is single-slot: a new arm overwrites the previous, never accumulates", () => {
    const latch = createMidFlightCommitLatch();
    latch.arm("task-1");
    latch.arm("task-2");
    // Only the latest holds; the previous transition is by then done/superseded.
    expect(latch.isArmed("task-1")).toBe(false);
    expect(latch.isArmed("task-2")).toBe(true);
  });

  it("does not leak across an INTERRUPT: a stale slot never reads for a later task", () => {
    const latch = createMidFlightCommitLatch();
    // Transition A armed but interrupted — its COMPLETED disarm never ran.
    latch.arm("task-A");
    // A later, non-deferring transition B: its passive side reads its OWN id and
    // must find no arm, so it uses the player as normal (no split).
    expect(latch.isArmed("task-B")).toBe(false);
    // The stale slot re-arming with B is a no-op it never triggers, and a
    // disarm(A) from A's late teardown is safe.
    latch.disarm("task-A");
    expect(latch.isArmed("task-A")).toBe(false);
    expect(latch.isArmed("task-B")).toBe(false);
  });
});

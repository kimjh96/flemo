import { afterEach, describe, expect, it } from "vitest";

import {
  consumeSelfInducedPop,
  createSelfPopGuard,
  markSelfInducedPop
} from "@navigate/selfPopGuard";

const drain = () => {
  while (consumeSelfInducedPop()) {
    /* drain remaining marks so test cases stay isolated */
  }
};

describe("selfPopGuard", () => {
  afterEach(drain);

  it("returns false when nothing was marked", () => {
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("consumes exactly one mark per call (FIFO counter)", () => {
    markSelfInducedPop();
    markSelfInducedPop();

    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("repeated mark-and-consume cycles stay independent", () => {
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);

    markSelfInducedPop();
    markSelfInducedPop();
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });

  it("a partial consume leaves the remainder available for later", () => {
    markSelfInducedPop();
    markSelfInducedPop();
    expect(consumeSelfInducedPop()).toBe(true);
    // 1 mark remains in flight. Should still resolve on the next call.
    expect(consumeSelfInducedPop()).toBe(true);
    expect(consumeSelfInducedPop()).toBe(false);
  });
});

describe("createSelfPopGuard", () => {
  it("returns false when nothing was marked", () => {
    const guard = createSelfPopGuard();
    expect(guard.consume()).toBe(false);
  });

  it("consumes exactly one mark per call", () => {
    const guard = createSelfPopGuard();
    guard.mark();
    guard.mark();

    expect(guard.consume()).toBe(true);
    expect(guard.consume()).toBe(true);
    expect(guard.consume()).toBe(false);
  });

  it("instances are independent: one guard's mark is not seen by another", () => {
    const a = createSelfPopGuard();
    const b = createSelfPopGuard();

    a.mark();
    a.mark();

    // b never marked, so it stays empty while a still holds its two marks.
    expect(b.consume()).toBe(false);
    expect(a.consume()).toBe(true);
    expect(b.consume()).toBe(false);
    expect(a.consume()).toBe(true);
    expect(a.consume()).toBe(false);
  });

  it("an instance guard is independent of the module-level default guard", () => {
    const guard = createSelfPopGuard();

    markSelfInducedPop();
    // The default guard's mark must not leak into the instance.
    expect(guard.consume()).toBe(false);
    // ...and the default still holds its own mark.
    expect(consumeSelfInducedPop()).toBe(true);
  });
});

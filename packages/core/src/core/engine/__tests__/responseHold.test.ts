import { afterEach, describe, expect, it, vi } from "vitest";

import { beginResponseHold, heldResponseCount, responseHoldDepth } from "@core/engine/responseHold";

// The module patches window.fetch once, lazily; these tests drive the patch
// through a controllable original.
let resolvers: ((r: unknown) => void)[] = [];
let rejecters: ((e: unknown) => void)[] = [];
const fakeFetch = () =>
  new Promise((resolve, reject) => {
    resolvers.push(resolve as never);
    rejecters.push(reject as never);
  });
// The module patches window.fetch ONCE (lazy, on first begin): the fake must
// be in place before that first begin and never reassigned afterwards, or a
// reassignment would silently discard the patch.
(window as { fetch: unknown }).fetch = fakeFetch;

describe("responseHold", () => {
  afterEach(() => {
    resolvers = [];
    rejecters = [];
    vi.useRealTimers();
  });

  it("delivers mid-hold resolutions in one batch at release", async () => {
    const release = beginResponseHold();
    const seen: string[] = [];
    const p1 = window.fetch("/a").then(() => seen.push("a"));
    const p2 = window.fetch("/b").then(() => seen.push("b"));
    resolvers[0]!({ ok: true });
    resolvers[1]!({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]); // parked: the flight owns the main thread
    expect(heldResponseCount()).toBe(2);

    release();
    await Promise.all([p1, p2]);
    expect(seen).toEqual(["a", "b"]); // delivered at rest, in arrival order
    expect(responseHoldDepth()).toBe(0);
  });

  it("holds rejections the same way (error renders are renders too)", async () => {
    const release = beginResponseHold();
    let failed = "";
    const p = window.fetch("/x").catch((e: Error) => {
      failed = e.message;
    });
    rejecters[0]!(new Error("boom"));
    await Promise.resolve();
    await Promise.resolve();
    expect(failed).toBe("");
    release();
    await p;
    expect(failed).toBe("boom");
  });

  it("outside a hold, responses pass straight through", async () => {
    const p = window.fetch("/free");
    resolvers[0]!({ ok: true });
    await expect(p).resolves.toEqual({ ok: true });
  });

  it("nested holds deliver at the LAST release; a release is idempotent", async () => {
    const r1 = beginResponseHold();
    const r2 = beginResponseHold();
    const seen: string[] = [];
    const p = window.fetch("/n").then(() => seen.push("n"));
    resolvers[0]!({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    r1();
    r1(); // idempotent
    await Promise.resolve();
    expect(seen).toEqual([]);
    r2();
    await p;
    expect(seen).toEqual(["n"]);
  });

  it("the backstop releases a stranded hold", async () => {
    vi.useFakeTimers();
    beginResponseHold(); // never released by its owner
    const seen: string[] = [];
    const p = window.fetch("/s").then(() => seen.push("s"));
    resolvers[0]!({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
    await p;
    expect(seen).toEqual(["s"]);
  });
});

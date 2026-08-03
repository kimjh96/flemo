import { afterEach, describe, expect, it, vi } from "vitest";

import { beginResponseHold, heldResponseCount, responseHoldDepth } from "@core/engine/responseHold";

// The module patches window.fetch once, lazily; these tests drive the patch
// through a controllable original that resolves with a stubbed Response.
let resolvers: ((r: unknown) => void)[] = [];
let rejecters: ((e: unknown) => void)[] = [];
const fakeFetch = () =>
  new Promise((resolve, reject) => {
    resolvers.push(resolve as never);
    rejecters.push(reject as never);
  });
// Installed ONCE, before the module's lazy patch, and never reassigned.
(window as { fetch: unknown }).fetch = fakeFetch;

const res = (contentType = "application/json") =>
  ({ headers: { get: (k: string) => (/content-type/i.test(k) ? contentType : null) } }) as Response;

describe("responseHold", () => {
  afterEach(() => {
    resolvers = [];
    rejecters = [];
    vi.useRealTimers();
  });

  it("parks a mid-hold GET resolution and delivers it at release", async () => {
    const release = beginResponseHold();
    const seen: string[] = [];
    const p = window.fetch("/a").then(() => seen.push("a"));
    resolvers[0]!(res());
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]); // parked: the flight owns the main thread
    expect(heldResponseCount()).toBe(1);

    release();
    await p;
    expect(seen).toEqual(["a"]);
    expect(responseHoldDepth()).toBe(0);
  });

  it("parks non-GET READS too (Supabase RPC = POST, count = HEAD)", async () => {
    // GET-only was device-falsified: an instrumented member-detail push showed
    // six HEAD count queries and one POST RPC resolving mid-flight past the
    // filter, each landing a render on the convergence frames. Reads and
    // mutations are indistinguishable at the fetch layer, so both park —
    // bounded by the flight-span backstop.
    const release = beginResponseHold();
    const seen: string[] = [];
    const rpc = window
      .fetch("/rest/v1/rpc/member_defied_detail", { method: "POST" })
      .then(() => seen.push("rpc"));
    const count = window.fetch("/rest/v1/votes", { method: "HEAD" }).then(() => seen.push("count"));
    resolvers[0]!(res());
    resolvers[1]!(res());
    await Promise.resolve();
    await Promise.resolve();
    expect(seen).toEqual([]); // parked mid-flight
    release();
    await Promise.all([rpc, count]);
    expect(seen.sort()).toEqual(["count", "rpc"]);
  });

  it("never parks a stream response (event-stream reaches the caller at once)", async () => {
    const release = beginResponseHold();
    let arrived = false;
    const p = window.fetch("/sse").then(() => {
      arrived = true;
    });
    resolvers[0]!(res("text/event-stream"));
    await Promise.resolve();
    await Promise.resolve();
    expect(arrived).toBe(true); // stream must not be held
    release();
    await p;
  });

  it("holds a rejection the same way (error renders are renders too)", async () => {
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
    const response = res();
    resolvers[0]!(response);
    await expect(p).resolves.toBe(response);
  });

  it("nested holds deliver at the LAST release; a release is idempotent", async () => {
    const r1 = beginResponseHold();
    const r2 = beginResponseHold();
    const seen: string[] = [];
    const p = window.fetch("/n").then(() => seen.push("n"));
    resolvers[0]!(res());
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

  it("the backstop releases a stranded hold at the flight span, not a fixed 2s", async () => {
    vi.useFakeTimers();
    beginResponseHold(4500); // a 3s transition + margin: must not flush at 2s
    const seen: string[] = [];
    const p = window.fetch("/long").then(() => seen.push("long"));
    resolvers[0]!(res());
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(2000);
    await Promise.resolve();
    expect(seen).toEqual([]); // still held — not flushed into the motion
    vi.advanceTimersByTime(2500); // past the real span
    vi.useRealTimers();
    await p;
    expect(seen).toEqual(["long"]);
  });
});

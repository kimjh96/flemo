import { beforeEach, describe, expect, it, vi } from "vitest";

// The module wraps window.fetch / XHR.send lazily on first use and keeps
// module-level state, so every test gets a fresh module against its own
// stubbed platform.
describe("pendingNetwork", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("counts a fetch from issue to resolution", async () => {
    let resolveFetch: (response: Response) => void;
    const original = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve))
    ) as unknown as typeof fetch;
    window.fetch = original;

    const { hasPendingRequests, pendingRequestCount } = await import("@screen/pendingNetwork");
    expect(hasPendingRequests()).toBe(false);

    const request = window.fetch("/data");
    expect(hasPendingRequests()).toBe(true);
    expect(pendingRequestCount()).toBe(1);

    resolveFetch!(new Response("ok"));
    await request;
    expect(hasPendingRequests()).toBe(false);
  });

  it("a rejected fetch settles the counter and preserves the rejection", async () => {
    let rejectFetch: (error: Error) => void;
    window.fetch = (() =>
      new Promise<Response>((_, reject) => (rejectFetch = reject))) as unknown as typeof fetch;

    const { hasPendingRequests } = await import("@screen/pendingNetwork");
    hasPendingRequests();
    const request = window.fetch("/data");
    expect(hasPendingRequests()).toBe(true);

    rejectFetch!(new Error("network down"));
    await expect(request).rejects.toThrow("network down");
    expect(hasPendingRequests()).toBe(false);
  });

  it("a synchronously-throwing fetch settles the counter and rethrows", async () => {
    window.fetch = (() => {
      throw new Error("blocked");
    }) as unknown as typeof fetch;

    const { hasPendingRequests } = await import("@screen/pendingNetwork");
    hasPendingRequests();
    expect(() => window.fetch("/data")).toThrow("blocked");
    expect(hasPendingRequests()).toBe(false);
  });

  it("counts an XHR from send to loadend, once", async () => {
    const originalSend = vi.fn();
    XMLHttpRequest.prototype.send = originalSend;

    const { hasPendingRequests } = await import("@screen/pendingNetwork");
    hasPendingRequests();

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/data");
    xhr.send();
    expect(originalSend).toHaveBeenCalledTimes(1);
    expect(hasPendingRequests()).toBe(true);

    xhr.dispatchEvent(new Event("loadend"));
    expect(hasPendingRequests()).toBe(false);
    // A duplicate terminal event must not underflow the counter.
    xhr.dispatchEvent(new Event("loadend"));
    expect(hasPendingRequests()).toBe(false);
  });
});

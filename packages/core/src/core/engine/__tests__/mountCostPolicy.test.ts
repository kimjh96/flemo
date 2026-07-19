import { describe, expect, it } from "vitest";

import {
  CONTENT_DEFER_THRESHOLD_MS,
  createMountCostPolicy,
  type MountCostStorage
} from "@core/engine/mountCostPolicy";

const memoryStorage = (initial: string | null = null) => {
  let value = initial;
  const storage: MountCostStorage = {
    read: () => value,
    write: (next) => {
      value = next;
    }
  };
  return { storage, get: () => value };
};

describe("createMountCostPolicy", () => {
  it("defers a route only after a measured block past the threshold", () => {
    const { storage } = memoryStorage();
    const policy = createMountCostPolicy(storage);

    expect(policy.shouldDeferContent("/members")).toBe(false);
    policy.record("/members", CONTENT_DEFER_THRESHOLD_MS - 1);
    expect(policy.shouldDeferContent("/members")).toBe(false);
    policy.record("/members", 380);
    expect(policy.shouldDeferContent("/members")).toBe(true);
    // Other routes are untouched — light screens keep content-first mounts.
    expect(policy.shouldDeferContent("/bills")).toBe(false);
  });

  it("a lighter re-measure clears the deferral", () => {
    const { storage } = memoryStorage();
    const policy = createMountCostPolicy(storage);
    policy.record("/members", 380);
    policy.record("/members", 12);
    expect(policy.shouldDeferContent("/members")).toBe(false);
  });

  it("records expire after a day, so an app that got lighter re-earns content-first", () => {
    const { storage } = memoryStorage();
    let nowMs = 1_000;
    const policy = createMountCostPolicy(storage, () => nowMs);
    policy.record("/members", 380);
    expect(policy.shouldDeferContent("/members")).toBe(true);
    nowMs += 24 * 60 * 60 * 1000 + 1;
    expect(policy.shouldDeferContent("/members")).toBe(false);
  });

  it("persists through storage and survives corrupt or hostile payloads", () => {
    const { storage, get } = memoryStorage();
    createMountCostPolicy(storage).record("/members", 380);
    // A fresh policy over the same storage sees the record.
    expect(createMountCostPolicy(storage).shouldDeferContent("/members")).toBe(true);
    expect(get()).toContain("/members");

    const corrupt = memoryStorage("not-json{");
    expect(createMountCostPolicy(corrupt.storage).shouldDeferContent("/members")).toBe(false);
    const hostile = memoryStorage(JSON.stringify({ "/members": { ms: "big", at: null } }));
    expect(createMountCostPolicy(hostile.storage).shouldDeferContent("/members")).toBe(false);
  });

  it("caps the persisted map at the newest fifty routes", () => {
    const { storage, get } = memoryStorage();
    let nowMs = 0;
    const policy = createMountCostPolicy(storage, () => nowMs);
    for (let i = 0; i < 60; i++) {
      nowMs += 1;
      policy.record(`/route-${i}`, 200);
    }
    const persisted = JSON.parse(get()!) as Record<string, unknown>;
    expect(Object.keys(persisted)).toHaveLength(50);
    // Oldest records fell out; the newest survive.
    expect(persisted["/route-0"]).toBeUndefined();
    expect(persisted["/route-59"]).toBeDefined();
  });

  it("the default storage tolerates a blocked localStorage", () => {
    localStorage.setItem("flemo:mount-cost", JSON.stringify({ "/m": { ms: 380, at: Date.now() } }));
    try {
      const policy = createMountCostPolicy();
      expect(policy.shouldDeferContent("/m")).toBe(true);
      policy.record("/m", 10);
      expect(policy.shouldDeferContent("/m")).toBe(false);
    } finally {
      localStorage.removeItem("flemo:mount-cost");
    }
  });
});

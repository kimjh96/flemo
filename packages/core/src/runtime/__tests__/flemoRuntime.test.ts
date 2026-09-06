import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetFlemoRuntimeForTests, startFlemoRuntime } from "@runtime/flemoRuntime";

// The ambient runtime: what an app sits in so the FIRST navigation is not the
// one that pays for it. None of it is triggered by a navigation, and none of it
// is framework-specific — which is why it lives here rather than in a binding.
//
// The refcount is the part worth pinning. A binding starts the runtime per
// Router mount, so a nested Router starts a second one; before this module they
// each installed their own document listeners.
//
// The pieces are counted rather than observed through the DOM: each one decides
// for itself whether it engages (the prewarm is Blink-only and idle-scheduled,
// the offloader rewrites <img> sources), so a suite that watched their elements
// would be testing their gates, not this module's refcount.
const prewarm = vi.hoisted(() => ({ starts: 0, disposes: 0 }));
const offload = vi.hoisted(() => ({ starts: 0, disposes: 0 }));
const profile = vi.hoisted(() => ({ imageDecodeOffload: false }));

vi.mock("@core/engine/gpuPipelinePrewarm", () => ({
  default: () => {
    prewarm.starts += 1;
    return () => {
      prewarm.disposes += 1;
    };
  }
}));

vi.mock("@core/engine/imageDecodeOffloader", () => ({
  default: () => {
    offload.starts += 1;
    return () => {
      offload.disposes += 1;
    };
  }
}));

vi.mock("@platform/profile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@platform/profile")>();
  return {
    ...actual,
    resolvePlatformProfile: () => ({
      ...actual.resolvePlatformProfile(),
      imageDecodeOffload: profile.imageDecodeOffload
    })
  };
});

beforeEach(() => {
  prewarm.starts = 0;
  prewarm.disposes = 0;
  offload.starts = 0;
  offload.disposes = 0;
  profile.imageDecodeOffload = false;
});

afterEach(() => {
  resetFlemoRuntimeForTests();
});

describe("startFlemoRuntime", () => {
  it("starts the ambient machinery once, however many holders take it", () => {
    const outer = startFlemoRuntime();
    expect(prewarm.starts).toBe(1);

    const inner = startFlemoRuntime();
    expect(prewarm.starts).toBe(1);

    inner();
    outer();
  });

  it("is refcounted: an inner Router unmounting leaves the outer one running", () => {
    const outer = startFlemoRuntime();
    const inner = startFlemoRuntime();

    inner();
    expect(prewarm.disposes).toBe(0);

    outer();
    expect(prewarm.disposes).toBe(1);
  });

  it("ignores a repeated release from the same holder", () => {
    const outer = startFlemoRuntime();
    const inner = startFlemoRuntime();
    inner();
    inner();
    inner();

    // A sloppy caller must not tear down a runtime the outer holder still owns.
    expect(prewarm.disposes).toBe(0);

    outer();
    expect(prewarm.disposes).toBe(1);
  });

  it("restarts cleanly after the last holder releases", () => {
    startFlemoRuntime()();
    expect(prewarm.starts).toBe(1);
    expect(prewarm.disposes).toBe(1);

    startFlemoRuntime()();
    expect(prewarm.starts).toBe(2);
    expect(prewarm.disposes).toBe(2);
  });

  it("engages the image-decode offloader only where the profile asks for it", () => {
    const off = startFlemoRuntime();
    expect(offload.starts).toBe(0);
    off();

    profile.imageDecodeOffload = true;
    const on = startFlemoRuntime();
    expect(offload.starts).toBe(1);
    on();
    expect(offload.disposes).toBe(1);
  });
});

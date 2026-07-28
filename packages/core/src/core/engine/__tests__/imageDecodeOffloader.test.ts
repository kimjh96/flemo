import { afterEach, describe, expect, it, vi } from "vitest";

import ensureImageDecodeOffloader, {
  createImageDecodeOffloader,
  OFFLOADED_SRC_ATTR,
  OVERSIZE_AREA_RATIO,
  shouldOffloadImage
} from "@core/engine/imageDecodeOffloader";

// jsdom has neither Worker nor OffscreenCanvas nor the Cache API, so the
// runtime paths are exercised with stubs; the pure decision logic is tested
// directly. The module has ONE intervention point — insertion — so the tests
// assert the three insertion outcomes: hold-then-reveal (unknown verdict),
// synchronous swap (known verdict), and never-touch (already painted).

// The transparent pixel a held element's src is parked on, mirrored from the
// module so the tests read the same constant the runtime writes.
const PARKED_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

describe("shouldOffloadImage", () => {
  it("flags only sources far beyond the box's device pixels", () => {
    // The measured production case: a 4971×7456 original in a 44px slot.
    expect(
      shouldOffloadImage({
        naturalWidth: 4971,
        naturalHeight: 7456,
        boxWidth: 44,
        boxHeight: 44,
        devicePixelRatio: 3
      })
    ).toBe(true);
    // A properly sized 2× asset is left alone.
    expect(
      shouldOffloadImage({
        naturalWidth: 96,
        naturalHeight: 96,
        boxWidth: 44,
        boxHeight: 44,
        devicePixelRatio: 2
      })
    ).toBe(false);
    // Right at the ratio boundary: not oversized.
    const area = 100 * 100 * 4 * OVERSIZE_AREA_RATIO;
    expect(
      shouldOffloadImage({
        naturalWidth: Math.sqrt(area),
        naturalHeight: Math.sqrt(area),
        boxWidth: 100,
        boxHeight: 100,
        devicePixelRatio: 2
      })
    ).toBe(false);
  });

  it("never flags unmeasurable boxes or empty sources", () => {
    expect(
      shouldOffloadImage({
        naturalWidth: 0,
        naturalHeight: 0,
        boxWidth: 44,
        boxHeight: 44,
        devicePixelRatio: 2
      })
    ).toBe(false);
    expect(
      shouldOffloadImage({
        naturalWidth: 4000,
        naturalHeight: 4000,
        boxWidth: 0,
        boxHeight: 0,
        devicePixelRatio: 2
      })
    ).toBe(false);
  });
});

// A worker whose reply is delivered by hand so each test controls when the
// verdict lands. `onmessage` is captured through a setter — the module assigns
// it once, right after construction.
const installWorkerStubs = () => {
  const posted: { url: string }[] = [];
  let handler: ((e: MessageEvent) => void) | null = null;
  class FakeWorker {
    set onmessage(next: (e: MessageEvent) => void) {
      handler = next;
    }
    postMessage(message: { url: string }) {
      posted.push(message);
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("OffscreenCanvas", class {});
  vi.stubGlobal("createImageBitmap", () => Promise.resolve());
  let created = 0;
  vi.stubGlobal("URL", {
    createObjectURL: (input: unknown) =>
      typeof input === "string" ? input : `blob:scaled-${created++}`,
    revokeObjectURL: vi.fn()
  });
  return { posted, reply: (data: unknown) => handler!({ data } as MessageEvent) };
};

// Insertion → observer microtask → readScaled microtask → rAF box measurement
// → probe. A macrotask drains the microtasks, then a rAF fires the measurement.
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const freshImage = (src: string) => {
  const image = document.createElement("img");
  // Fresh = inserted but not yet painted: the browser has fetched nothing.
  // configurable so responsive tests can re-define dimensions "at load".
  Object.defineProperty(image, "complete", { value: false, configurable: true });
  Object.defineProperty(image, "naturalWidth", { value: 0, configurable: true });
  image.setAttribute("src", src);
  image.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;
  return image;
};

const paintedImage = (src: string) => {
  const image = document.createElement("img");
  Object.defineProperty(image, "complete", { value: true });
  Object.defineProperty(image, "naturalWidth", { value: 4971 });
  Object.defineProperty(image, "naturalHeight", { value: 7456 });
  image.setAttribute("src", src);
  image.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;
  return image;
};

describe("createImageDecodeOffloader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("degrades to a noop where the required APIs are missing (jsdom/SSR)", () => {
    const dispose = createImageDecodeOffloader(document.body);
    expect(() => dispose()).not.toThrow();
  });

  it("holds a fresh network image pre-paint, then reveals the scaled result as its first frame", async () => {
    const { posted, reply } = installWorkerStubs();
    const src = "https://example.test/raw-original.jpg";
    const image = freshImage(src);
    document.body.appendChild(image);

    const dispose = createImageDecodeOffloader(document.body);
    // Held immediately: hidden and parked on a transparent pixel so the
    // worker's fetch is the single download of the original.
    expect(image.style.visibility).toBe("hidden");
    expect(image.getAttribute("src")).toBe(PARKED_PIXEL);
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe(src);

    await flush();
    expect(posted).toHaveLength(1);
    expect(posted[0].url).toBe(src);

    reply({ url: src, blob: new Blob(["x"]) });
    // First appearance is the downscaled result; the authored source is kept
    // on the element for anything that reads it.
    expect(image.getAttribute("src")).toContain("blob:scaled");
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe(src);
    expect(image.style.visibility).toBe("");

    dispose();
  });

  it("restores the authored source when the worker answers skip (well-sized)", async () => {
    const { reply } = installWorkerStubs();
    const src = "https://example.test/fitted.jpg";
    const image = freshImage(src);
    document.body.appendChild(image);

    const dispose = createImageDecodeOffloader(document.body);
    expect(image.getAttribute("src")).toBe(PARKED_PIXEL);
    await flush();

    reply({ url: src, skip: true });
    // The authored original is revealed; no leftover offloader bookkeeping.
    expect(image.getAttribute("src")).toBe(src);
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe(null);
    expect(image.style.visibility).toBe("");

    dispose();
  });

  it("never re-points or hides an image that has already painted", async () => {
    const { posted, reply } = installWorkerStubs();
    const src = "https://example.test/painted.jpg";
    const image = paintedImage(src);
    document.body.appendChild(image);

    const dispose = createImageDecodeOffloader(document.body);
    // A visible element is untouchable — re-pointing or hiding it is a blink.
    // It is probed for FUTURE mounts, but stays exactly as authored now.
    expect(image.getAttribute("src")).toBe(src);
    expect(image.style.visibility).toBe("");
    expect(posted).toHaveLength(1);

    reply({ url: src, blob: new Blob(["x"]) });
    // Even with the verdict in hand, the painted element is not swapped.
    expect(image.getAttribute("src")).toBe(src);

    dispose();
  });

  it("responsive well-sized (next/image and its kin): revealed as authored at load, zero worker cost", async () => {
    const { posted } = installWorkerStubs();
    // next/image shape: an optimizer src plus pre-scaled srcset candidates.
    const responsive = freshImage("https://example.test/_next/image?url=raw.jpg&w=88");
    responsive.setAttribute(
      "srcset",
      "https://example.test/_next/image?url=raw.jpg&w=44 44w, https://example.test/_next/image?url=raw.jpg&w=88 88w"
    );
    document.body.append(responsive);

    const dispose = createImageDecodeOffloader(document.body);
    // Held (visibility only — the browser's own selection/download proceeds;
    // an img shows nothing before its resource anyway, so this adds nothing).
    expect(responsive.style.visibility).toBe("hidden");
    expect(responsive.getAttribute("src")).toBe(
      "https://example.test/_next/image?url=raw.jpg&w=88"
    );

    // The chosen candidate loads well-sized: revealed as authored, no probe.
    Object.defineProperty(responsive, "currentSrc", {
      value: "https://example.test/_next/image?url=raw.jpg&w=88"
    });
    Object.defineProperty(responsive, "naturalWidth", { value: 88, configurable: true });
    Object.defineProperty(responsive, "naturalHeight", { value: 88, configurable: true });
    responsive.dispatchEvent(new Event("load"));
    await flush();
    expect(responsive.style.visibility).toBe("");
    expect(responsive.getAttribute("srcset")).not.toBeNull();
    expect(posted).toHaveLength(0);

    dispose();
  });

  it("responsive oversized (degenerate srcset around a raw original): scaled and pinned", async () => {
    const { posted, reply } = installWorkerStubs();
    const raw = "https://example.test/raw-original.jpg";
    const picture = document.createElement("picture");
    const source = document.createElement("source");
    source.setAttribute("srcset", raw);
    const image = freshImage(raw);
    image.setAttribute("srcset", `${raw} 1x`);
    picture.append(source, image);
    document.body.append(picture);

    const dispose = createImageDecodeOffloader(document.body);
    expect(image.style.visibility).toBe("hidden");

    // The browser picked the raw original; its REAL dimensions arrive at load.
    Object.defineProperty(image, "currentSrc", { value: raw });
    Object.defineProperty(image, "naturalWidth", { value: 4971, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 7456, configurable: true });
    image.dispatchEvent(new Event("load"));
    await flush();
    // Still hidden through the probe — the original never paints.
    expect(image.style.visibility).toBe("hidden");
    expect(posted).toHaveLength(1);
    expect(posted[0].url).toBe(raw);

    reply({ url: raw, blob: new Blob(["x"]) });
    // First appearance = the scaled result, candidate markup stripped so the
    // swap wins (img srcset/sizes AND <picture> <source> siblings).
    expect(image.getAttribute("src")).toContain("blob:scaled");
    expect(image.getAttribute("srcset")).toBeNull();
    expect(source.getAttribute("srcset")).toBeNull();
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe(raw);
    expect(image.style.visibility).toBe("");

    dispose();
  });

  it("responsive load error reveals the authored element untouched", async () => {
    installWorkerStubs();
    const image = freshImage("https://example.test/broken.jpg");
    image.setAttribute("srcset", "https://example.test/broken.jpg 1x");
    document.body.append(image);

    const dispose = createImageDecodeOffloader(document.body);
    expect(image.style.visibility).toBe("hidden");
    image.dispatchEvent(new Event("error"));
    // The authored error path (consumer onError fallbacks) proceeds visibly.
    expect(image.style.visibility).toBe("");
    expect(image.getAttribute("srcset")).not.toBeNull();

    dispose();
  });

  it("leaves non-network sources (data:/blob:) exactly as authored", async () => {
    const { posted } = installWorkerStubs();
    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { value: false });
    Object.defineProperty(image, "naturalWidth", { value: 0 });
    image.setAttribute("src", "data:image/gif;base64,R0lGOD");
    image.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;
    document.body.appendChild(image);

    const dispose = createImageDecodeOffloader(document.body);
    await flush();
    // Never held, never probed.
    expect(image.getAttribute("src")).toBe("data:image/gif;base64,R0lGOD");
    expect(image.style.visibility).toBe("");
    expect(posted).toHaveLength(0);

    dispose();
  });
});

describe("createImageDecodeOffloader verdict cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("swaps a remounted image synchronously once its source's verdict is known", async () => {
    const { posted, reply } = installWorkerStubs();
    const src = "https://example.test/raw.jpg";

    const first = freshImage(src);
    document.body.appendChild(first);
    const dispose = createImageDecodeOffloader(document.body);
    await flush();
    expect(posted).toHaveLength(1);
    reply({ url: src, blob: new Blob(["x"]) });
    const scaled = first.getAttribute("src");
    expect(scaled).toContain("blob:scaled");

    // The screen unmounts and remounts (a later navigation): the fresh element
    // swaps at insertion — no hold, no new worker job, no original paint.
    first.remove();
    const second = freshImage(src);
    document.body.appendChild(second);
    await flush();
    expect(second.getAttribute("src")).toBe(scaled);
    expect(second.getAttribute(OFFLOADED_SRC_ATTR)).toBe(src);
    expect(second.style.visibility).toBe("");
    expect(posted).toHaveLength(1); // still just the one job

    dispose();
  });

  it("stops re-probing and never holds once a source's skip verdict is known", async () => {
    const { posted, reply } = installWorkerStubs();
    const src = "https://example.test/fitted.jpg";

    const first = freshImage(src);
    document.body.appendChild(first);
    const dispose = createImageDecodeOffloader(document.body);
    await flush();
    reply({ url: src, skip: true });
    expect(first.getAttribute("src")).toBe(src);

    first.remove();
    const again = freshImage(src);
    document.body.appendChild(again);
    await flush();
    // Known skip: never held, never re-probed, authored source untouched from
    // the first frame.
    expect(posted).toHaveLength(1);
    expect(again.getAttribute("src")).toBe(src);
    expect(again.style.visibility).toBe("");

    dispose();
  });
});

describe("ensureImageDecodeOffloader", () => {
  it("refcounts a single document-wide offloader across mounts", () => {
    const first = ensureImageDecodeOffloader();
    const second = ensureImageDecodeOffloader();
    expect(() => {
      first();
      second();
    }).not.toThrow();
  });
});

// A hand-rolled Cache API: enough surface for persistScaled/readScaled.
const installCacheStub = (seed: Record<string, Blob> = {}) => {
  const store = new Map<string, Blob>(Object.entries(seed));
  const put = vi.fn(async (url: string, response: Response) => {
    store.set(url, await response.blob());
  });
  const match = vi.fn(async (url: string) => {
    const blob = store.get(url);
    return blob ? new Response(blob) : undefined;
  });
  vi.stubGlobal("caches", { open: async () => ({ put, match }) });
  return { put, match, store };
};

describe("createImageDecodeOffloader scaled-result cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("a prior session's scaled result swaps at insertion with zero worker cost", async () => {
    const { posted } = installWorkerStubs();
    installCacheStub({ "https://cdn.example/huge.jpg": new Blob(["scaled"]) });
    const dispose = createImageDecodeOffloader(document.body);

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    await flush();

    expect(image.getAttribute("src")).toMatch(/^blob:scaled-/);
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe("https://cdn.example/huge.jpg");
    expect(posted).toHaveLength(0);
    dispose();
  });

  it("persists a fresh scale so the next session can swap at insertion", async () => {
    const { posted, reply } = installWorkerStubs();
    const { put } = installCacheStub();
    const dispose = createImageDecodeOffloader(document.body);

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    expect(posted).toHaveLength(1);

    reply({ url: "https://cdn.example/huge.jpg", blob: new Blob(["scaled"]) });
    await flush();
    expect(put).toHaveBeenCalledWith("https://cdn.example/huge.jpg", expect.any(Response));
    expect(image.getAttribute("src")).toMatch(/^blob:scaled-/);
    dispose();
  });

  it("a throwing Cache API degrades to the worker probe", async () => {
    const { posted } = installWorkerStubs();
    vi.stubGlobal("caches", {
      open: async () => {
        throw new Error("storage disabled");
      }
    });
    const dispose = createImageDecodeOffloader(document.body);

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();

    expect(posted).toHaveLength(1);
    dispose();
  });
});

describe("createImageDecodeOffloader degraded and terminal paths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("a refused blob worker leaves the held image to the reveal timeout", async () => {
    installWorkerStubs();
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("CSP: blob workers forbidden");
        }
      }
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const dispose = createImageDecodeOffloader(document.body);

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await vi.advanceTimersByTimeAsync(0);
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    await vi.advanceTimersByTimeAsync(0);
    expect(image.getAttribute("src")).toBe(PARKED_PIXEL);

    // No worker will ever answer: the safety timeout reveals the original.
    await vi.advanceTimersByTimeAsync(15001);
    expect(image.getAttribute("src")).toBe("https://cdn.example/huge.jpg");
    expect(image.style.visibility).toBe("");
    dispose();
  });

  it("a worker error reveals the authored original (skip verdict)", async () => {
    const { posted, reply } = installWorkerStubs();
    const dispose = createImageDecodeOffloader(document.body);

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    expect(posted).toHaveLength(1);

    reply({ url: "https://cdn.example/huge.jpg", error: "http 403" });
    expect(image.getAttribute("src")).toBe("https://cdn.example/huge.jpg");
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBeNull();
    dispose();
  });

  it("disposal releases every held image and revokes scaled object URLs", async () => {
    const { posted, reply } = installWorkerStubs();
    const dispose = createImageDecodeOffloader(document.body);

    const settled = freshImage("https://cdn.example/settled.jpg");
    const pending = freshImage("https://cdn.example/pending.jpg");
    document.body.appendChild(settled);
    document.body.appendChild(pending);
    await flush();
    expect(posted).toHaveLength(2);
    reply({ url: "https://cdn.example/settled.jpg", blob: new Blob(["scaled"]) });
    expect(settled.getAttribute("src")).toMatch(/^blob:scaled-/);

    dispose();
    // The still-held image first-appears as its authored self...
    expect(pending.getAttribute("src")).toBe("https://cdn.example/pending.jpg");
    expect(pending.style.visibility).toBe("");
    // ...and the scaled result's object URL does not leak.
    expect(
      (URL as unknown as { revokeObjectURL: ReturnType<typeof vi.fn> }).revokeObjectURL
    ).toHaveBeenCalled();
  });
});

describe("createImageDecodeOffloader responsive verdicts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const responsiveImage = (src: string) => {
    const image = freshImage(src);
    image.setAttribute("srcset", `${src} 1x`);
    return image;
  };

  const loadAt = (image: HTMLImageElement, width: number, height: number) => {
    Object.defineProperty(image, "currentSrc", {
      value: image.getAttribute("src"),
      configurable: true
    });
    Object.defineProperty(image, "naturalWidth", { value: width, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: height, configurable: true });
    image.dispatchEvent(new Event("load"));
  };

  it("a responsive load whose source verdict is already known releases synchronously", async () => {
    const { reply } = installWorkerStubs();
    const dispose = createImageDecodeOffloader(document.body);

    // Establish the verdict through a bare image first.
    const bare = freshImage("https://cdn.example/shared.jpg");
    document.body.appendChild(bare);
    await flush();
    reply({ url: "https://cdn.example/shared.jpg", blob: new Blob(["scaled"]) });

    const responsive = responsiveImage("https://cdn.example/shared.jpg");
    document.body.appendChild(responsive);
    await flush();
    loadAt(responsive, 4971, 7456);
    await flush();

    expect(responsive.getAttribute("src")).toMatch(/^blob:scaled-/);
    expect(responsive.getAttribute("srcset")).toBeNull();
    dispose();
  });

  it("a responsive oversized load rides the scaled-result cache without a probe", async () => {
    const { posted } = installWorkerStubs();
    installCacheStub({ "https://cdn.example/wp.jpg": new Blob(["scaled"]) });
    const dispose = createImageDecodeOffloader(document.body);

    const responsive = responsiveImage("https://cdn.example/wp.jpg");
    document.body.appendChild(responsive);
    await flush();
    loadAt(responsive, 4971, 7456);
    await flush();
    await flush();

    expect(responsive.getAttribute("src")).toMatch(/^blob:scaled-/);
    expect(posted).toHaveLength(0);
    dispose();
  });
});

// A cache stub whose match resolves only when the test says so — for racing
// verdicts against an in-flight cache read.
const installDeferredCacheStub = () => {
  const pending: Array<(blob: Blob | undefined) => void> = [];
  vi.stubGlobal("caches", {
    open: async () => ({
      put: vi.fn(),
      match: () =>
        new Promise<Response | undefined>((resolve) => {
          pending.push((blob) => resolve(blob ? new Response(blob) : undefined));
        })
    })
  });
  // Resolves the OLDEST outstanding read.
  return { resolveMatch: (blob: Blob | undefined) => pending.shift()?.(blob) };
};

describe("createImageDecodeOffloader branch edges", () => {
  // A failing assertion must not leak a live observer into the next test —
  // it would mark and park that test's images before its own offloader runs.
  const disposers: Array<() => void> = [];
  const track = (dispose: () => void) => {
    disposers.push(dispose);
    return dispose;
  };
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("a responsive element that already painted is untouched", async () => {
    installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = paintedImage("https://cdn.example/huge.jpg");
    image.setAttribute("srcset", "https://cdn.example/huge.jpg 1x");
    document.body.appendChild(image);
    await flush();
    expect(image.style.visibility).toBe("");
    expect(image.getAttribute("srcset")).not.toBeNull();
    dispose();
  });

  it("a responsive element that never loads is revealed by the safety timeout", async () => {
    installWorkerStubs();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    image.setAttribute("srcset", "https://cdn.example/huge.jpg 1x");
    document.body.appendChild(image);
    await vi.advanceTimersByTimeAsync(0);
    expect(image.style.visibility).toBe("hidden");

    await vi.advanceTimersByTimeAsync(15001);
    expect(image.style.visibility).toBe("");
    dispose();
  });

  it("a settle landing while the responsive cache read is in flight releases it once", async () => {
    const { reply } = installWorkerStubs();
    const { resolveMatch } = installDeferredCacheStub();
    const dispose = track(createImageDecodeOffloader(document.body));

    const bare = freshImage("https://cdn.example/race.jpg");
    document.body.appendChild(bare);
    await flush();
    // Resolve the bare image's cache read (miss) so its probe runs.
    resolveMatch(undefined);
    await flush();

    const responsive = freshImage("https://cdn.example/race.jpg");
    responsive.setAttribute("srcset", "https://cdn.example/race.jpg 1x");
    document.body.appendChild(responsive);
    await flush();
    Object.defineProperty(responsive, "naturalWidth", { value: 4971, configurable: true });
    Object.defineProperty(responsive, "naturalHeight", { value: 7456, configurable: true });
    responsive.dispatchEvent(new Event("load"));

    // The probe's verdict settles BOTH held elements while the responsive
    // element's own cache read is still in flight...
    reply({ url: "https://cdn.example/race.jpg", blob: new Blob(["scaled"]) });
    expect(responsive.getAttribute("src")).toMatch(/^blob:scaled-/);
    // ...so the late read finds it already released and changes nothing.
    resolveMatch(new Blob(["late"]));
    await flush();
    expect(responsive.getAttribute("src")).toMatch(/^blob:scaled-/);
    dispose();
  });

  it("falls back to a bare measure where requestAnimationFrame is missing", async () => {
    const { posted } = installWorkerStubs();
    const originalRaf = globalThis.requestAnimationFrame;
    // @ts-expect-error simulating an environment without rAF
    delete globalThis.requestAnimationFrame;
    try {
      const dispose = track(createImageDecodeOffloader(document.body));
      const image = freshImage("https://cdn.example/huge.jpg");
      document.body.appendChild(image);
      await new Promise((resolve) => setTimeout(resolve, 0));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(posted).toHaveLength(1);
      dispose();
    } finally {
      globalThis.requestAnimationFrame = originalRaf;
    }
  });

  it("unmeasurable boxes probe at the minimum target size", async () => {
    const { posted } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = paintedImage("https://cdn.example/huge.jpg");
    image.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    document.body.appendChild(image);
    await flush();
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ url: "https://cdn.example/huge.jpg" });
    dispose();
  });

  it("two fresh mounts of one source share a single probe and settle together", async () => {
    const { posted, reply } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const first = freshImage("https://cdn.example/shared.jpg");
    const second = freshImage("https://cdn.example/shared.jpg");
    const other = freshImage("https://cdn.example/other.jpg");
    document.body.appendChild(first);
    document.body.appendChild(second);
    document.body.appendChild(other);
    await flush();
    expect(posted.filter((p) => p.url === "https://cdn.example/shared.jpg")).toHaveLength(1);

    reply({ url: "https://cdn.example/shared.jpg", blob: new Blob(["scaled"]) });
    expect(first.getAttribute("src")).toMatch(/^blob:scaled-/);
    expect(second.getAttribute("src")).toMatch(/^blob:scaled-/);
    // The unrelated hold stays parked.
    expect(other.getAttribute("src")).toBe(PARKED_PIXEL);
    // A duplicate reply for the same source keeps the first verdict.
    reply({ url: "https://cdn.example/shared.jpg", blob: new Blob(["scaled-again"]) });
    dispose();
  });

  it("release restores a pre-existing inline visibility", async () => {
    const { reply } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    image.style.visibility = "visible";
    document.body.appendChild(image);
    await flush();
    expect(image.style.visibility).toBe("hidden");

    reply({ url: "https://cdn.example/huge.jpg", skip: true });
    expect(image.style.visibility).toBe("visible");
    dispose();
  });

  it("a consumer re-pointing a held image keeps its own src at release", async () => {
    const { reply } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    expect(image.getAttribute("src")).toBe(PARKED_PIXEL);

    // React re-pointed the element mid-hold: the park is gone, so the
    // release must not overwrite the consumer's write.
    image.setAttribute("src", "https://cdn.example/replaced.jpg");
    reply({ url: "https://cdn.example/huge.jpg", skip: true });
    expect(image.getAttribute("src")).toBe("https://cdn.example/replaced.jpg");
    dispose();
  });

  it("ignores re-encounters, own swaps, and srcless or text insertions", async () => {
    const { posted, reply } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));

    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    reply({ url: "https://cdn.example/huge.jpg", blob: new Blob(["scaled"]) });

    // Re-inserting the SAME element must not re-hold it...
    image.remove();
    document.body.appendChild(image);
    // ...nor must an element already carrying our swap marker...
    const swapped = freshImage("https://cdn.example/other.jpg");
    swapped.setAttribute(OFFLOADED_SRC_ATTR, "https://cdn.example/other.jpg");
    document.body.appendChild(swapped);
    // ...nor a srcless img or a plain text node.
    const srcless = document.createElement("img");
    document.body.appendChild(srcless);
    document.body.appendChild(document.createTextNode("텍스트"));
    await flush();

    expect(posted).toHaveLength(1);
    dispose();
  });

  it("a cache read resolving after disposal changes nothing", async () => {
    installWorkerStubs();
    const { resolveMatch } = installDeferredCacheStub();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await new Promise((resolve) => setTimeout(resolve, 0));

    dispose();
    expect(image.getAttribute("src")).toBe("https://cdn.example/huge.jpg");
    resolveMatch(new Blob(["late"]));
    await flush();
    expect(image.getAttribute("src")).toBe("https://cdn.example/huge.jpg");
  });

  it("probes at devicePixelRatio 1 where the platform reports none", async () => {
    const { posted } = installWorkerStubs();
    vi.stubGlobal("devicePixelRatio", undefined);
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = paintedImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await flush();
    expect(posted).toHaveLength(1);
    dispose();
  });
});

describe("ensureImageDecodeOffloader disposer edges", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("a second call to a spent disposer is a no-op", () => {
    installWorkerStubs();
    const release = ensureImageDecodeOffloader();
    release();
    release(); // shared is already gone
    const again = ensureImageDecodeOffloader();
    again();
  });
});

describe("createImageDecodeOffloader zero-layout and disposal races", () => {
  const disposers: Array<() => void> = [];
  const track = (dispose: () => void) => {
    disposers.push(dispose);
    return dispose;
  };
  afterEach(() => {
    for (const dispose of disposers.splice(0)) dispose();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("a responsive candidate with no layout probes at the minimum box", async () => {
    const { posted } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    image.setAttribute("srcset", "https://cdn.example/huge.jpg 1x");
    image.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    document.body.appendChild(image);
    await flush();

    Object.defineProperty(image, "naturalWidth", { value: 4971, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 7456, configurable: true });
    image.dispatchEvent(new Event("load"));
    await flush();
    await flush();
    expect(posted).toHaveLength(1);
    dispose();
  });

  it("a fresh image with no layout probes at the minimum box", async () => {
    const { posted } = installWorkerStubs();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    image.getBoundingClientRect = () => ({ width: 0, height: 0 }) as DOMRect;
    document.body.appendChild(image);
    await flush();
    expect(posted).toHaveLength(1);
    dispose();
  });

  it("a measurement frame arriving after disposal probes nothing", async () => {
    const { posted } = installWorkerStubs();
    const measured: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
      measured.push(frameCallback);
      return measured.length;
    });
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    document.body.appendChild(image);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(measured.length).toBeGreaterThan(0);

    dispose();
    for (const frameCallback of measured) frameCallback(0);
    expect(posted).toHaveLength(0);
  });

  it("a responsive cache read resolving after disposal changes nothing", async () => {
    installWorkerStubs();
    const { resolveMatch } = installDeferredCacheStub();
    const dispose = track(createImageDecodeOffloader(document.body));
    const image = freshImage("https://cdn.example/huge.jpg");
    image.setAttribute("srcset", "https://cdn.example/huge.jpg 1x");
    document.body.appendChild(image);
    await flush();
    Object.defineProperty(image, "naturalWidth", { value: 4971, configurable: true });
    Object.defineProperty(image, "naturalHeight", { value: 7456, configurable: true });
    image.dispatchEvent(new Event("load"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    dispose();
    resolveMatch(new Blob(["late"]));
    await flush();
    expect(image.getAttribute("src")).toBe("https://cdn.example/huge.jpg");
  });
});

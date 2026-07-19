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
  Object.defineProperty(image, "complete", { value: false });
  Object.defineProperty(image, "naturalWidth", { value: 0 });
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

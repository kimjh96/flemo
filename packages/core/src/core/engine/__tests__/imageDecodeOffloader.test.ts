import { afterEach, describe, expect, it, vi } from "vitest";

import ensureImageDecodeOffloader, {
  createImageDecodeOffloader,
  OFFLOADED_SRC_ATTR,
  OVERSIZE_AREA_RATIO,
  shouldOffloadImage
} from "@core/engine/imageDecodeOffloader";

// jsdom has neither Worker nor OffscreenCanvas, so the runtime paths are
// exercised with stubs; the decision logic is pure and tested directly.

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

describe("createImageDecodeOffloader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("degrades to a noop where the required APIs are missing (jsdom/SSR)", () => {
    const dispose = createImageDecodeOffloader(document.body);
    expect(() => dispose()).not.toThrow();
  });

  it("swaps an oversized image to the worker's downscaled result and keeps the authored source", async () => {
    let workerHandler: ((e: MessageEvent) => void) | null = null;
    const posted: unknown[] = [];
    class FakeWorker {
      set onmessage(handler: (e: MessageEvent) => void) {
        workerHandler = handler;
      }
      postMessage(message: unknown) {
        posted.push(message);
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", () => Promise.resolve());
    const objectUrls: string[] = [];
    vi.stubGlobal("URL", {
      createObjectURL: (input: unknown) => {
        const url = typeof input === "string" ? input : `blob:fake-${objectUrls.length}`;
        objectUrls.push(url);
        return url;
      },
      revokeObjectURL: vi.fn()
    });

    const image = document.createElement("img");
    Object.defineProperty(image, "complete", { value: true });
    Object.defineProperty(image, "naturalWidth", { value: 4971 });
    Object.defineProperty(image, "naturalHeight", { value: 7456 });
    Object.defineProperty(image, "currentSrc", {
      get: () => image.getAttribute("src") ?? ""
    });
    image.setAttribute("src", "https://example.test/raw-original.jpg");
    image.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;
    document.body.appendChild(image);

    const dispose = createImageDecodeOffloader(document.body);
    // Submission happens one frame after insertion (box measurement).
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    expect(posted).toHaveLength(1);
    expect((posted[0] as { url: string }).url).toBe("https://example.test/raw-original.jpg");

    workerHandler!({
      data: { url: "https://example.test/raw-original.jpg", blob: new Blob(["x"]) }
    } as MessageEvent);
    expect(image.getAttribute(OFFLOADED_SRC_ATTR)).toBe("https://example.test/raw-original.jpg");
    expect(image.getAttribute("src")).toContain("blob:fake");

    dispose();
  });

  it("probes network images in the worker but never touches non-network sources", async () => {
    const posted: unknown[] = [];
    class FakeWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      postMessage(message: unknown) {
        posted.push(message);
      }
      terminate() {}
    }
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("OffscreenCanvas", class {});
    vi.stubGlobal("createImageBitmap", () => Promise.resolve());
    vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: vi.fn() });

    const fitted = document.createElement("img");
    Object.defineProperty(fitted, "complete", { value: true });
    Object.defineProperty(fitted, "naturalWidth", { value: 96 });
    Object.defineProperty(fitted, "naturalHeight", { value: 96 });
    fitted.setAttribute("src", "https://example.test/fitted.jpg");
    fitted.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;

    const dataUrl = document.createElement("img");
    Object.defineProperty(dataUrl, "complete", { value: true });
    Object.defineProperty(dataUrl, "naturalWidth", { value: 4000 });
    Object.defineProperty(dataUrl, "naturalHeight", { value: 4000 });
    dataUrl.setAttribute("src", "data:image/gif;base64,R0lGOD");
    dataUrl.getBoundingClientRect = () => ({ width: 44, height: 44 }) as DOMRect;

    document.body.append(fitted, dataUrl);
    const dispose = createImageDecodeOffloader(document.body);
    await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    // The network image is probed (the WORKER answers skip for well-sized
    // sources); the data: URL is never submitted at all.
    expect(posted).toHaveLength(1);
    expect((posted[0] as { url: string }).url).toBe("https://example.test/fitted.jpg");
    // A skip reply swaps nothing.
    expect(fitted.getAttribute("src")).toBe("https://example.test/fitted.jpg");
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

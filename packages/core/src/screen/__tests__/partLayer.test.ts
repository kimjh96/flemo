import { afterEach, describe, expect, it, vi } from "vitest";

import createNavigateStore from "@navigate/store";

import { PART_LAYER_ATTR } from "@dom/attributes";

import { registerPartLayer, resolvePartLayer } from "@screen/partLayer";

// WHERE A MATCHED BAR'S PARTS ARE STAGED.
//
// Per Router SCOPE rather than per document, for the reason the flight layer is:
// a nested Router draws inside a box of its own, and a document-level layer
// would stage its parts straight out of it. The fallback exists for a binding
// that publishes none — right for a root Router, wrong for a contained one,
// which is exactly the case a binding is expected to publish.

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.querySelectorAll(`[${PART_LAYER_ATTR}]`).forEach((node) => node.remove());
});

describe("resolvePartLayer", () => {
  it("prefers the layer its own scope published", () => {
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerPartLayer(store, published);

    expect(resolvePartLayer(store)).toBe(published);
  });

  it("keeps one scope's layer out of another's", () => {
    const mine = createNavigateStore();
    const theirs = createNavigateStore();
    const layer = document.createElement("div");
    document.body.appendChild(layer);
    registerPartLayer(mine, layer);

    expect(resolvePartLayer(theirs)).not.toBe(layer);
  });

  it("falls back once, and reuses that fallback", () => {
    const store = createNavigateStore();
    const first = resolvePartLayer(store);
    const second = resolvePartLayer(store);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(document.body.querySelectorAll(`[${PART_LAYER_ATTR}]`)).toHaveLength(1);
  });

  it("falls back when the published layer has left the document", () => {
    // A Router unmounts without unregistering — a frozen zone, a hot reload —
    // and parts staged in a detached node would never be seen.
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerPartLayer(store, published);
    published.remove();

    const resolved = resolvePartLayer(store);
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBe(published);
  });

  it("forgets a layer when its Router unpublishes", () => {
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerPartLayer(store, published);
    registerPartLayer(store, null);

    expect(resolvePartLayer(store)).not.toBe(published);
  });

  it("does not share a box with the morph layer", () => {
    // Two lifetimes, two boxes. A morph owns the layer it stages in — it writes
    // the z-index and strips the mirrored hold on landing — and a part flight
    // outliving that landing would have its hold torn out from under it.
    const store = createNavigateStore();
    const partLayer = resolvePartLayer(store);

    expect(partLayer?.getAttribute(PART_LAYER_ATTR)).toBe("");
  });

  it("has nowhere to stage on the server", () => {
    vi.stubGlobal("document", undefined);
    expect(resolvePartLayer(createNavigateStore())).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

import createNavigateStore from "@navigate/store";

import { MORPH_LAYER_ATTR } from "@dom/attributes";

import { registerMorphLayer, resolveMorphLayer } from "@morph/morphLayer";

// WHERE A FLIGHT IS STAGED.
//
// The layer is per Router SCOPE rather than per document, because a nested
// Router draws inside a box of its own and a document-level layer would fly its
// shared elements straight out of it. The fallback exists for a binding that
// publishes none — right for a root Router, wrong for a contained one, which is
// exactly the case a binding is expected to publish.

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.querySelectorAll(`[${MORPH_LAYER_ATTR}]`).forEach((node) => node.remove());
});

describe("resolveMorphLayer", () => {
  it("prefers the layer its own scope published", () => {
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerMorphLayer(store, published);

    expect(resolveMorphLayer(store)).toBe(published);
  });

  it("keeps one scope's layer out of another's", () => {
    const mine = createNavigateStore();
    const theirs = createNavigateStore();
    const layer = document.createElement("div");
    document.body.appendChild(layer);
    registerMorphLayer(mine, layer);

    expect(resolveMorphLayer(theirs)).not.toBe(layer);
  });

  it("falls back once, and reuses that fallback", () => {
    const store = createNavigateStore();
    const first = resolveMorphLayer(store);
    const second = resolveMorphLayer(store);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(document.body.querySelectorAll(`[${MORPH_LAYER_ATTR}]`)).toHaveLength(1);
  });

  it("falls back when the published layer has left the document", () => {
    // A Router unmounts without unregistering — a frozen zone, a hot reload —
    // and a flight staged in a detached node would never be seen.
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerMorphLayer(store, published);
    published.remove();

    const resolved = resolveMorphLayer(store);
    expect(resolved).not.toBeNull();
    expect(resolved).not.toBe(published);
  });

  it("forgets a layer when its Router unpublishes", () => {
    const store = createNavigateStore();
    const published = document.createElement("div");
    document.body.appendChild(published);
    registerMorphLayer(store, published);
    registerMorphLayer(store, null);

    expect(resolveMorphLayer(store)).not.toBe(published);
  });

  it("has nowhere to stage a flight on the server", () => {
    vi.stubGlobal("document", undefined);
    expect(resolveMorphLayer(createNavigateStore())).toBeNull();
  });
});

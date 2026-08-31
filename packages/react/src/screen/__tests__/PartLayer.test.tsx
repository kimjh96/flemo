import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { PART_LAYER_ATTR, resolvePartLayer } from "@flemo/core";

import PartLayer from "@screen/PartLayer";

import { createTestStores } from "@stores/__tests__/testUtils";

import type { FlemoStores } from "@stores/StoreContext";

// The box a matched shared bar's parts are staged in. The Router renders it and
// publishes it to its own scope, because only a Router knows which box bounds
// its screens — the engine then takes it as a DOM node beside the scope and the
// bars, and never has to know about stores.

let stores: FlemoStores;

beforeEach(() => {
  stores = createTestStores();
  document.body.querySelectorAll(`[${PART_LAYER_ATTR}]`).forEach((node) => node.remove());
});

describe("PartLayer", () => {
  it("publishes itself to its own Router scope", () => {
    const { container } = render(<PartLayer stores={stores} />);
    const layer = container.querySelector(`[${PART_LAYER_ATTR}]`);

    expect(layer).not.toBeNull();
    expect(resolvePartLayer(stores.navigate)).toBe(layer);
  });

  it("holds nothing at rest and takes no pointer input", () => {
    // An empty full-size box that swallowed taps would take every one meant for
    // the screen under it.
    const { container } = render(<PartLayer stores={stores} />);
    const layer = container.querySelector<HTMLElement>(`[${PART_LAYER_ATTR}]`)!;

    expect(layer.childElementCount).toBe(0);
    expect(layer.style.pointerEvents).toBe("none");
    // Absolute, not fixed: a Router mounted inside a bounded frame stages its
    // parts inside that frame rather than against the viewport.
    expect(layer.style.position).toBe("absolute");
  });

  it("keeps the travelling duplicate out of the accessibility tree", () => {
    const { container } = render(<PartLayer stores={stores} />);
    const layer = container.querySelector<HTMLElement>(`[${PART_LAYER_ATTR}]`)!;

    expect(layer.getAttribute("aria-hidden")).toBe("true");
  });

  it("unpublishes when its Router goes", () => {
    const { unmount } = render(<PartLayer stores={stores} />);
    unmount();

    // Whatever resolves now is the document-level fallback, not the box that
    // just left the tree.
    expect(resolvePartLayer(stores.navigate)?.isConnected).toBe(true);
  });
});

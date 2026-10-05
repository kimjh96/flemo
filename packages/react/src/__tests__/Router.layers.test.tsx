import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Layer from "@screen/Layer";
import Screen from "@screen/Screen";

import Route from "@Route";

import Router from "../Router";

// WHERE A NESTED ROUTER'S LAYER LANDS.
//
// By default one host serves a whole chain of Routers, and it is the outermost
// screen's, so an overlay can clear the chrome an ancestor declared. A Router
// that is its own app inside another (a preview, a demo) opts out with
// `ownsLayers`: its outermost screen hosts its overlays, inside its region.

function app(ownsLayers: boolean) {
  return render(
    <Router initPath="/" history="memory">
      <Route
        path="/"
        element={
          <Screen>
            <Router initPath="/" history="memory" className="region" ownsLayers={ownsLayers}>
              <Route
                path="/"
                element={
                  <Screen>
                    <Layer>
                      <div data-testid="sheet" />
                    </Layer>
                  </Screen>
                }
              />
            </Router>
          </Screen>
        }
      />
    </Router>
  );
}

describe("a nested Router's Layer host", () => {
  it("is the outermost screen's by default, outside the nested region", () => {
    const { container, getByTestId } = app(false);

    const region = container.querySelector<HTMLElement>(".region")!;
    const hosts = container.querySelectorAll("[data-flemo-layer-host]");
    expect(hosts).toHaveLength(1);
    expect(region.contains(hosts[0]!)).toBe(false);
    expect(region.contains(getByTestId("sheet"))).toBe(false);
  });

  it("is the nested Router's own with ownsLayers, inside its region", () => {
    const { container, getByTestId } = app(true);

    const region = container.querySelector<HTMLElement>(".region")!;
    const hosts = [...container.querySelectorAll("[data-flemo-layer-host]")];
    // The outer chain keeps its host, and the nested Router renders a second.
    expect(hosts).toHaveLength(2);
    const own = hosts.find((host) => region.contains(host));
    expect(own).toBeDefined();
    expect(own!.contains(getByTestId("sheet"))).toBe(true);
  });
});

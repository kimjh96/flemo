import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";

import { afterEach, describe, expect, it, vi } from "vitest";

import { FlemoDevtools } from "../react";
import { FlemoDevtools as InertFlemoDevtools } from "../reactNoop";

import type { FlemoReport, FlightRecorderHandle } from "../types";

// THE SHAPE A CONSUMER WRITES.
//
// `<FlemoDevtools />` and nothing else: no effect, no dynamic import, no
// cancellation flag, no knowing which export condition resolves where. Every
// one of those was a thing a consumer had to get right, and the first one to
// get it wrong put the real panel into a public bundle.

const hosts = () => document.querySelectorAll("[data-flemo-devtools-panel]");
const inRoot = (selector: string) =>
  [...hosts()].some((host) => host.shadowRoot?.querySelector(selector) !== null);

const stub = (): FlightRecorderHandle => ({
  report: () =>
    ({
      flights: [],
      preconditions: [],
      environment: { rafCadence: { medianGapMs: 16.7, sampleCount: 20 } }
    }) as unknown as FlemoReport,
  detach: vi.fn(),
  mark: () => null
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("<FlemoDevtools />", () => {
  it("renders nothing and mounts both surfaces", () => {
    const { container } = render(createElement(FlemoDevtools, { recorder: stub() }));
    expect(container.innerHTML).toBe("");
    expect(hosts()).toHaveLength(2);
    expect(inRoot(".hud")).toBe(true);
    expect(inRoot(".panel")).toBe(true);
  });

  it("takes both down when it unmounts", () => {
    const { unmount } = render(createElement(FlemoDevtools, { recorder: stub() }));
    expect(hosts()).toHaveLength(2);
    unmount();
    expect(hosts()).toHaveLength(0);
  });

  it("leaves a recorder it was handed alone", () => {
    const recorder = stub();
    const { unmount } = render(createElement(FlemoDevtools, { recorder }));
    unmount();
    expect(recorder.detach).not.toHaveBeenCalled();
  });

  it("mounts only the readout when the drawer is declined", () => {
    render(createElement(FlemoDevtools, { recorder: stub(), panel: false }));
    expect(hosts()).toHaveLength(1);
    expect(inRoot(".hud")).toBe(true);
    expect(inRoot(".panel")).toBe(false);
  });

  it("mounts only the drawer when the readout is declined", () => {
    render(createElement(FlemoDevtools, { recorder: stub(), hud: false }));
    expect(hosts()).toHaveLength(1);
    expect(inRoot(".panel")).toBe(true);
    expect(inRoot(".hud")).toBe(false);
  });

  it("mounts neither when both are declined", () => {
    render(createElement(FlemoDevtools, { recorder: stub(), hud: false, panel: false }));
    expect(hosts()).toHaveLength(0);
  });

  // A consumer writing `buckets={["A", "B"]}` inline hands in a new array on
  // every render. Through an identity dependency that would detach and rebuild
  // the drawer under a user who is reading it, on every render.
  it("does not rebuild the surfaces when a re-render passes an equal bucket list", () => {
    const recorder = stub();
    const { rerender } = render(createElement(FlemoDevtools, { recorder, buckets: ["A", "B"] }));
    const before = [...hosts()];
    rerender(createElement(FlemoDevtools, { recorder, buckets: ["A", "B"] }));
    // By IDENTITY: a rebuilt host is a different node that looks the same, so
    // a structural comparison would pass either way.
    expect([...hosts()][0]).toBe(before[0]);
    expect([...hosts()][1]).toBe(before[1]);
  });

  it("rebuilds when the bucket list actually changes", () => {
    const recorder = stub();
    const { rerender } = render(createElement(FlemoDevtools, { recorder, buckets: ["A"] }));
    const before = [...hosts()];
    rerender(createElement(FlemoDevtools, { recorder, buckets: ["A", "B"] }));
    expect([...hosts()][0]).not.toBe(before[0]);
    expect(hosts()).toHaveLength(2);
  });

  it("takes the default props when it is given none", () => {
    render(createElement(FlemoDevtools));
    expect(hosts()).toHaveLength(2);
  });
});

describe("<FlemoDevtools /> in a production build", () => {
  it("renders null and mounts nothing at all", () => {
    const { container } = render(createElement(InertFlemoDevtools, { hud: true, panel: true }));
    expect(container.innerHTML).toBe("");
    expect(hosts()).toHaveLength(0);
  });

  it("is callable with no props, like the real one", () => {
    expect(InertFlemoDevtools()).toBeNull();
  });
});

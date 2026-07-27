import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Route from "@Route";

const dispose = vi.fn();
const ensure = vi.fn(() => dispose);

vi.mock("@flemo/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flemo/core")>();
  return { ...actual, ensureImageDecodeOffloader: ensure };
});

const { default: Router } = await import("../Router");

beforeEach(() => {
  ensure.mockClear();
  dispose.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Router image-decode offloader", () => {
  it("mounts the offloader once and disposes it with the Router", () => {
    const view = render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(ensure).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("lets each Router take its own refcounted hold", () => {
    const first = render(
      <Router>
        <Route path="/" element={<div>a</div>} />
      </Router>
    );
    const second = render(
      <Router>
        <Route path="/" element={<div>b</div>} />
      </Router>
    );

    // The module itself refcounts a single document-wide observer; every
    // Router must still take and drop its own hold.
    expect(ensure).toHaveBeenCalledTimes(2);

    first.unmount();
    second.unmount();

    expect(dispose).toHaveBeenCalledTimes(2);
  });
});

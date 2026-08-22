import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Route from "@Route";

const release = vi.fn();
const start = vi.fn(() => release);

vi.mock("@flemo/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@flemo/core")>();
  return { ...actual, startFlemoRuntime: start };
});

const { default: Router } = await import("../Router");

// flemo's AMBIENT machinery — GPU pipelines compiled ahead of the first flight,
// oversized image decodes kept off the main thread, the compositor kept awake
// while the user is about to navigate — is core's (`startFlemoRuntime`). WHAT it
// does and WHEN each piece engages is pinned in core's own suites.
//
// What the binding still owns, and all this file asserts, is the LIFETIME: a
// mounted Router is when an app wants that machinery, and an unmounted one is
// when it does not.

beforeEach(() => {
  start.mockClear();
  release.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("Router and the ambient runtime", () => {
  it("starts it on mount and releases it on unmount", () => {
    const view = render(
      <Router>
        <Route path="/" element={<div>home</div>} />
      </Router>
    );

    expect(start).toHaveBeenCalledTimes(1);
    expect(release).not.toHaveBeenCalled();

    view.unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("takes one hold per Router, and drops each with its own unmount", () => {
    // The runtime itself is refcounted (see core's flemoRuntime suite), but
    // every Router still has to take and drop its OWN hold — a nested Router
    // unmounting must not end the outer one's runtime.
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

    expect(start).toHaveBeenCalledTimes(2);

    first.unmount();
    expect(release).toHaveBeenCalledTimes(1);
    second.unmount();
    expect(release).toHaveBeenCalledTimes(2);
  });
});

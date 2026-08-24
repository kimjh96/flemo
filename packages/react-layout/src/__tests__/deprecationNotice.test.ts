import { afterEach, describe, expect, it, vi } from "vitest";

import deprecationNotice from "../deprecationNotice";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("deprecationNotice", () => {
  it("says where shared elements went, once", () => {
    // Once per session, not once per render: both components call it, and a
    // notice that repeats every commit is noise a consumer learns to ignore.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    deprecationNotice("LayoutScreen");
    deprecationNotice("LayoutConfig");

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("<Morph");
    expect(warn.mock.calls[0]![0]).toContain("@flemo/react");
  });
});

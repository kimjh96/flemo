import { describe, expect, it, vi } from "vitest";

import resolveTransition from "@transition/resolveTransition";

describe("resolveTransition", () => {
  it("falls back to the built-in none for an unregistered name", () => {
    expect(resolveTransition("definitely-not-registered" as never).name).toBe("none");
  });

  it("reports an unregistered name, unless asked to stay quiet", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(resolveTransition("quiet-unregistered" as never, { quiet: true }).name).toBe("none");
      expect(error).not.toHaveBeenCalled();
      resolveTransition("loud-unregistered" as never);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('"loud-unregistered"'));
    } finally {
      error.mockRestore();
    }
  });

  it("returns the registered transition", () => {
    expect(resolveTransition("cupertino" as never).name).toBe("cupertino");
  });
});

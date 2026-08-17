import { describe, expect, it } from "vitest";

import resolveTransition from "@transition/resolveTransition";

describe("resolveTransition", () => {
  it("falls back to the built-in none for an unregistered name", () => {
    expect(resolveTransition("definitely-not-registered" as never).name).toBe("none");
  });

  it("returns the registered transition", () => {
    expect(resolveTransition("cupertino" as never).name).toBe("cupertino");
  });
});

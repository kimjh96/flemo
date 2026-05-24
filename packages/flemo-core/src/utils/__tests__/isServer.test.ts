import { describe, expect, it } from "vitest";

import isServer from "@utils/isServer";

describe("isServer", () => {
  it("returns false in jsdom (document is defined)", () => {
    expect(isServer()).toBe(false);
  });
});

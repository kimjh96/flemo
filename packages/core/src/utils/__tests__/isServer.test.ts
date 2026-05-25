import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import isServer from "@utils/isServer";

describe("isServer", () => {
  it("returns false in jsdom (document is defined)", () => {
    expect(isServer()).toBe(false);
  });

  describe("when document is undefined (SSR shape)", () => {
    beforeAll(() => {
      vi.stubGlobal("document", undefined);
    });
    afterAll(() => {
      vi.unstubAllGlobals();
    });

    it("returns true when there is no document global", () => {
      expect(isServer()).toBe(true);
    });
  });
});

import { describe, expect, it } from "vitest";

import matchesPathname from "@utils/matchesPathname";

describe("matchesPathname", () => {
  it("matches a static pattern", () => {
    expect(matchesPathname("/about", "/about")).toBe(true);
    expect(matchesPathname("/about", "/contact")).toBe(false);
  });

  it("matches a dynamic pattern", () => {
    expect(matchesPathname("/posts/:id", "/posts/42")).toBe(true);
    expect(matchesPathname("/posts/:id", "/posts")).toBe(false);
  });

  it("matches when any pattern of a set matches", () => {
    expect(matchesPathname(["/a", "/b/:id"], "/b/1")).toBe(true);
    expect(matchesPathname(["/a", "/b/:id"], "/c")).toBe(false);
  });

  it("matches a catch-all pattern", () => {
    expect(matchesPathname("/*path", "/anything/here")).toBe(true);
  });
});

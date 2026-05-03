import { describe, expect, it } from "vitest";

import buildRoutePath from "@utils/buildRoutePath";

describe("buildRoutePath", () => {
  it("compiles path params and appends extra params as search", () => {
    const result = buildRoutePath("/users/:id", { id: 42, ref: "home" } as never);

    expect(result.toPathname).toBe("/users/42");
    expect(result.pathname).toBe("/users/42?ref=home");
  });

  it("returns pathname unchanged when there are no extra params", () => {
    const result = buildRoutePath("/about", {} as never);

    expect(result.toPathname).toBe("/about");
    expect(result.pathname).toBe("/about");
  });

  it("stringifies non-string param values", () => {
    const result = buildRoutePath("/posts/:slug", {
      slug: "hello",
      page: 2
    } as never);

    expect(result.pathname).toBe("/posts/hello?page=2");
  });
});

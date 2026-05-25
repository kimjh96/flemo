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

  it("fills multiple path params in order", () => {
    const result = buildRoutePath("/users/:userId/posts/:postId", {
      userId: 42,
      postId: "abc"
    } as never);
    expect(result.toPathname).toBe("/users/42/posts/abc");
    expect(result.pathname).toBe("/users/42/posts/abc");
  });

  it("only puts unused params in the query string", () => {
    const result = buildRoutePath("/posts/:slug", {
      slug: "hello",
      tab: "comments",
      filter: "new"
    } as never);
    expect(result.toPathname).toBe("/posts/hello");
    expect(result.pathname.startsWith("/posts/hello?")).toBe(true);
    // URLSearchParams ordering is insertion-stable.
    expect(result.pathname).toContain("tab=comments");
    expect(result.pathname).toContain("filter=new");
  });

  it("handles null / undefined params by falling back to an empty object", () => {
    const result = buildRoutePath("/about", undefined as never);
    expect(result.toPathname).toBe("/about");
    expect(result.pathname).toBe("/about");
  });

  it("URL-encodes query values", () => {
    const result = buildRoutePath("/q", { q: "hello world" } as never);
    expect(result.pathname).toBe("/q?q=hello+world");
  });
});

import { describe, expect, it } from "vitest";

import getParams from "@utils/getParams";

describe("getParams", () => {
  it("merges path params and query params", () => {
    expect(getParams("/users/:id", "/users/42", "?ref=home")).toEqual({
      id: "42",
      ref: "home"
    });
  });

  it("returns only query params when no path param is present", () => {
    expect(getParams("/about", "/about", "?ref=home")).toEqual({ ref: "home" });
  });

  it("returns an empty object when no pattern matches", () => {
    expect(getParams("/users/:id", "/teams/42", "")).toEqual({});
  });

  it("query params override path params with the same key", () => {
    expect(getParams("/users/:id", "/users/1", "?id=2")).toEqual({ id: "2" });
  });

  it("returns multiple path params from a multi-segment route", () => {
    expect(getParams("/users/:userId/posts/:postId", "/users/42/posts/abc", "")).toEqual({
      userId: "42",
      postId: "abc"
    });
  });

  it("merges multiple query params", () => {
    expect(getParams("/search", "/search", "?q=hello&page=2&limit=20")).toEqual({
      q: "hello",
      page: "2",
      limit: "20"
    });
  });

  it("URL-decodes query values via URLSearchParams", () => {
    expect(getParams("/q", "/q", "?q=hello%20world")).toEqual({ q: "hello world" });
  });

  it("falls through path-array variants until one matches", () => {
    expect(getParams(["/users/:id", "/posts/:slug"], "/posts/hello", "")).toEqual({
      slug: "hello"
    });
  });
});

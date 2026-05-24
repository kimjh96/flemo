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
});

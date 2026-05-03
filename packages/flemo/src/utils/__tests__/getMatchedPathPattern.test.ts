import { describe, expect, it } from "vitest";

import getMatchedPathPattern from "@utils/getMatchedPathPattern";

describe("getMatchedPathPattern", () => {
  it("returns the pattern itself when it matches a single path", () => {
    expect(getMatchedPathPattern("/users/:id", "/users/42")).toBe("/users/:id");
  });

  it("returns empty string when a single path does not match", () => {
    expect(getMatchedPathPattern("/users/:id", "/teams/42")).toBe("");
  });

  it("finds the matching pattern within an array", () => {
    expect(getMatchedPathPattern(["/", "/users/:id", "/posts/:slug"], "/posts/hello")).toBe(
      "/posts/:slug"
    );
  });

  it("returns empty string when no array entry matches", () => {
    expect(getMatchedPathPattern(["/users/:id", "/posts/:slug"], "/orphan")).toBe("");
  });
});

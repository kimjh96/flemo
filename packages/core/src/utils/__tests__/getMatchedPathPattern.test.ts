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

  it("returns the first matching pattern when multiple candidates would match", () => {
    // Both `/users/:id` and `/users/me` could match `/users/me`; the array
    // walks in order, so the first listed candidate wins.
    expect(getMatchedPathPattern(["/users/:id", "/users/me"], "/users/me")).toBe("/users/:id");
  });

  it("matches the root path exactly", () => {
    expect(getMatchedPathPattern("/", "/")).toBe("/");
    expect(getMatchedPathPattern("/", "/anything")).toBe("");
  });

  it("matches multi-segment dynamic patterns", () => {
    expect(getMatchedPathPattern("/users/:userId/posts/:postId", "/users/42/posts/abc")).toBe(
      "/users/:userId/posts/:postId"
    );
    expect(getMatchedPathPattern("/users/:userId/posts/:postId", "/users/42")).toBe("");
  });

  it("does not match when the pathname has extra trailing segments", () => {
    expect(getMatchedPathPattern("/users/:id", "/users/42/extra")).toBe("");
  });
});

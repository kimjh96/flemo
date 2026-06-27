import { describe, expect, it } from "vitest";

import ensureWindowHistoryState from "@history/ensureWindowHistoryState";
import seedInitialHistory from "@history/seedInitialHistory";

describe("seedInitialHistory", () => {
  it("builds the root frame with resolved path + query params", () => {
    const root = seedInitialHistory(["/posts/:slug"], "/posts/hello", "?ref=home", "cupertino");
    expect(root).toEqual({
      id: "root",
      pathname: "/posts/hello",
      params: { slug: "hello", ref: "home" },
      transitionName: "cupertino",
      layoutId: null
    });
  });

  it("uses the given default transition name", () => {
    expect(seedInitialHistory(["/"], "/", "", "material").transitionName).toBe("material");
  });
});

describe("ensureWindowHistoryState", () => {
  it("replaceStates the root frame when no flemo state is present", () => {
    window.history.replaceState(null, "", window.location.href);
    ensureWindowHistoryState("cupertino");
    expect(window.history.state).toMatchObject({
      id: "root",
      index: 0,
      status: "IDLE",
      transitionName: "cupertino"
    });
  });

  it("is a no-op when a flemo frame already exists", () => {
    window.history.replaceState({ id: "x", index: 5 }, "", window.location.href);
    ensureWindowHistoryState("cupertino");
    expect(window.history.state).toMatchObject({ id: "x", index: 5 });
  });
});

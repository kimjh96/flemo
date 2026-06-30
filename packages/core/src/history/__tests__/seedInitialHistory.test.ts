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

describe("ensureWindowHistoryState (keyless / legacy bare seed)", () => {
  it("replaceStates the root frame when no flemo state is present", () => {
    window.history.replaceState(null, "", window.location.href);
    ensureWindowHistoryState(null, "cupertino");
    expect(window.history.state).toMatchObject({
      id: "root",
      index: 0,
      status: "IDLE",
      transitionName: "cupertino"
    });
  });

  it("is a no-op when a flemo frame already exists", () => {
    window.history.replaceState({ id: "x", index: 5 }, "", window.location.href);
    ensureWindowHistoryState(null, "cupertino");
    expect(window.history.state).toMatchObject({ id: "x", index: 5 });
  });
});

describe("ensureWindowHistoryState (keyed)", () => {
  it("merges the root frame under the routerKey without changing the URL", () => {
    window.history.replaceState(null, "", window.location.href);
    ensureWindowHistoryState("docs", "material");

    expect(window.history.state).toMatchObject({
      docs: { id: "root", index: 0, status: "IDLE", transitionName: "material" }
    });
  });

  it("preserves a sibling Router's frame already in the entry", () => {
    window.history.replaceState({ shell: { id: "root", index: 3 } }, "", window.location.href);
    ensureWindowHistoryState("docs", "cupertino");

    // The shell frame is untouched; the docs key is added alongside it.
    expect(window.history.state.shell).toMatchObject({ id: "root", index: 3 });
    expect(window.history.state.docs).toMatchObject({ id: "root", index: 0 });
  });

  it("is a no-op when this key already carries a non-root index", () => {
    window.history.replaceState({ docs: { id: "x", index: 2 } }, "", window.location.href);
    ensureWindowHistoryState("docs", "cupertino");

    expect(window.history.state.docs).toMatchObject({ id: "x", index: 2 });
  });
});

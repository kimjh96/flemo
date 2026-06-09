import { beforeEach, describe, expect, it } from "vitest";

import createTransitionStore, { type TransitionStoreApi } from "@transition/store";

let store: TransitionStoreApi;

describe("createTransitionStore", () => {
  beforeEach(() => {
    store = createTransitionStore();
  });

  it("defaults the transition name to `cupertino`", () => {
    expect(store.getState().defaultTransitionName).toBe("cupertino");
  });

  it("accepts a seeded default transition name", () => {
    expect(createTransitionStore("material").getState().defaultTransitionName).toBe("material");
  });

  it("setDefaultTransitionName updates the active default", () => {
    store.getState().setDefaultTransitionName("material");
    expect(store.getState().defaultTransitionName).toBe("material");

    store.getState().setDefaultTransitionName("none");
    expect(store.getState().defaultTransitionName).toBe("none");
  });
});

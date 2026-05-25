import { beforeEach, describe, expect, it } from "vitest";

import useTransitionStore from "@transition/store";

const reset = () => useTransitionStore.setState({ defaultTransitionName: "cupertino" });

describe("useTransitionStore", () => {
  beforeEach(reset);

  it("defaults the transition name to `cupertino`", () => {
    expect(useTransitionStore.getState().defaultTransitionName).toBe("cupertino");
  });

  it("setDefaultTransitionName updates the active default", () => {
    useTransitionStore.getState().setDefaultTransitionName("material");
    expect(useTransitionStore.getState().defaultTransitionName).toBe("material");

    useTransitionStore.getState().setDefaultTransitionName("none");
    expect(useTransitionStore.getState().defaultTransitionName).toBe("none");
  });
});

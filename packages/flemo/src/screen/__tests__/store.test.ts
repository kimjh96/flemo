import { beforeEach, describe, expect, it } from "vitest";

import useScreenStore from "@screen/store";

describe("useScreenStore shared bar registry", () => {
  beforeEach(() => {
    useScreenStore.setState({ sharedBars: {} });
  });

  it("registers a screen's shared bar presence", () => {
    useScreenStore.getState().registerSharedBars("a", { appBar: true, navigationBar: false });

    expect(useScreenStore.getState().sharedBars).toEqual({
      a: { appBar: true, navigationBar: false }
    });
  });

  it("removes an entry on unregister without touching others", () => {
    const { registerSharedBars, unregisterSharedBars } = useScreenStore.getState();

    registerSharedBars("a", { appBar: true, navigationBar: true });
    registerSharedBars("b", { appBar: false, navigationBar: true });
    unregisterSharedBars("a");

    expect(useScreenStore.getState().sharedBars).toEqual({
      b: { appBar: false, navigationBar: true }
    });
  });
});

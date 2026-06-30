import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import usePathname from "@navigate/usePathname";

import { createTestStores, storesWrapper } from "@stores/__tests__/testUtils";

// usePathname reads the active history entry's pathname from the store bundle,
// the same bundle a <Router> provides. The harness seeds a known history so we
// can assert the value and its reactivity without a full Router tree.
const entry = (pathname: string) => ({
  id: pathname,
  pathname,
  params: {},
  transitionName: "none" as const,
  layoutId: null
});

describe("usePathname", () => {
  it("returns the destination history entry's pathname", () => {
    const stores = createTestStores();
    stores.history.setState({ index: 0, pendingIndex: 0, histories: [entry("/showcase")] });

    const { result } = renderHook(() => usePathname(), { wrapper: storesWrapper(stores) });

    expect(result.current).toBe("/showcase");
  });

  it("updates reactively when navigation changes the active entry", () => {
    const stores = createTestStores();
    stores.history.setState({ index: 0, pendingIndex: 0, histories: [entry("/")] });

    const { result } = renderHook(() => usePathname(), { wrapper: storesWrapper(stores) });
    expect(result.current).toBe("/");

    act(() => {
      stores.history.setState({
        index: 1,
        pendingIndex: 1,
        histories: [entry("/"), entry("/docs")]
      });
    });

    expect(result.current).toBe("/docs");
  });

  it("reports a pop destination immediately, before index moves", () => {
    const stores = createTestStores();
    stores.history.setState({
      index: 1,
      pendingIndex: 1,
      histories: [entry("/"), entry("/docs")]
    });

    const { result } = renderHook(() => usePathname(), { wrapper: storesWrapper(stores) });
    expect(result.current).toBe("/docs");

    // A pop starts: pendingIndex moves to the destination while index lags on the
    // leaving screen until the transition resolves.
    act(() => {
      stores.history.setState({ pendingIndex: 0 });
    });

    expect(result.current).toBe("/");
  });

  it("falls back to / when there is no active entry", () => {
    const stores = createTestStores();
    stores.history.setState({ index: -1, pendingIndex: -1, histories: [] });

    const { result } = renderHook(() => usePathname(), { wrapper: storesWrapper(stores) });

    expect(result.current).toBe("/");
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";
import useScreen from "@screen/useScreen";

function Probe() {
  const screen = useScreen();
  return <span data-testid="probe">{JSON.stringify(screen)}</span>;
}

describe("useScreen", () => {
  it("returns the default context shape when rendered outside of any provider", () => {
    const { getByTestId } = render(<Probe />);
    const ctx = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(ctx.id).toBe("");
    expect(ctx.isActive).toBe(false);
    expect(ctx.isRoot).toBe(true);
    expect(ctx.zIndex).toBe(0);
    expect(ctx.transitionName).toBe("none");
  });

  it("returns the provided context value verbatim", () => {
    const value: ScreenContextProps = {
      id: "screen-1",
      isActive: true,
      isRoot: false,
      isPrev: false,
      zIndex: 2,
      pathname: "/posts/42",
      params: { id: "42" },
      transitionName: "cupertino",
      prevTransitionName: "cupertino",
      layoutId: 42,
      routePath: "/posts/:id"
    };

    const { getByTestId } = render(
      <ScreenContext.Provider value={value}>
        <Probe />
      </ScreenContext.Provider>
    );
    const ctx = JSON.parse(getByTestId("probe").textContent ?? "{}");
    expect(ctx).toEqual(value);
  });
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ScreenParamsContext from "@screen/ParamsProvider/ParamsContext";
import useParams from "@screen/ParamsProvider/useParams";

declare module "@Route" {
  interface RegisterRoute {
    "/users/:id": { id: string };
  }
}

function Probe() {
  const params = useParams<"/users/:id">();
  return <span data-testid="probe">{JSON.stringify(params)}</span>;
}

describe("useParams", () => {
  it("reads the params object from ParamsContext", () => {
    const { getByTestId } = render(
      <ScreenParamsContext.Provider value={{ id: "42" }}>
        <Probe />
      </ScreenParamsContext.Provider>
    );
    expect(JSON.parse(getByTestId("probe").textContent ?? "{}")).toEqual({ id: "42" });
  });

  it("returns the default empty object when no provider wraps", () => {
    const { getByTestId } = render(<Probe />);
    expect(JSON.parse(getByTestId("probe").textContent ?? "{}")).toEqual({});
  });
});

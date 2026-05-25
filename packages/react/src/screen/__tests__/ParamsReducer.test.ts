import { describe, expect, it } from "vitest";

import ParamsReducer from "@screen/ParamsProvider/ParamsReducer";

describe("ParamsReducer", () => {
  it("SET replaces state with the action's params", () => {
    const next = ParamsReducer({ id: "1" }, { type: "SET", params: { id: "2", q: "hi" } });
    expect(next).toEqual({ id: "2", q: "hi" });
  });

  it("SET to an empty object clears params", () => {
    const next = ParamsReducer({ id: "1" }, { type: "SET", params: {} });
    expect(next).toEqual({});
  });

  it("unknown action types return the previous state unchanged", () => {
    const prev = { id: "1" };
    const next = ParamsReducer(prev, { type: "UNKNOWN" } as never);
    expect(next).toBe(prev);
  });
});

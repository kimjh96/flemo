import * as core from "@flemo/core";
import { describe, expect, it } from "vitest";

import * as devtools from "../domProtocol";

// This package keeps its OWN copy of the `data-flemo-*` names (see
// domProtocol.ts — it observes pages whose flemo version it cannot assume, so
// it takes no runtime dependency on core). The copy is pinned here.
//
// @flemo/core is a devDependency only: this test imports it, the shipped
// bundle never does. Without this check the duplication is exactly the drift
// that let the flag registry rot — five keys added to core that the panel could
// never toggle, two dead ones it still offered.

describe("the recorder's copy of the DOM protocol", () => {
  it("spells every observed attribute the way core writes it", () => {
    const pairs: [string, string][] = [
      [devtools.SCREEN_ATTR, core.SCREEN_ATTR],
      [devtools.STATUS_ATTR, core.STATUS_ATTR],
      [devtools.ACTIVE_ATTR, core.ACTIVE_ATTR],
      [devtools.ROUTER_ATTR, core.ROUTER_ATTR],
      [devtools.ANIM_HOLD_ATTR, core.ANIM_HOLD_ATTR],
      [devtools.IMAGE_HOLD_ATTR, core.IMAGE_HOLD_ATTR],
      [devtools.HELD_ARRIVAL_ATTR, core.HELD_ARRIVAL_ATTR],
      [devtools.PART_NAME_ATTR, core.PART_NAME_ATTR],
      [devtools.DECORATOR_ATTR, core.DECORATOR_ATTR],
      [devtools.BAR_ATTR, core.BAR_ATTR],
      [devtools.BAR_STATUS_ATTR, core.BAR_STATUS_ATTR],
      [devtools.BAR_RIDING_ATTR, core.BAR_RIDING_ATTR],
      [devtools.DEVTOOLS_PANEL_ATTR, core.DEVTOOLS_PANEL_ATTR]
    ];
    for (const [mine, theirs] of pairs) expect(mine).toBe(theirs);
  });

  it("observes only attributes core actually declares", () => {
    const declared = new Set<string>(core.FLEMO_ATTRIBUTES);
    const observed = Object.entries(devtools).filter(
      ([name, value]) => name.endsWith("_ATTR") && typeof value === "string"
    );
    expect(observed.length).toBeGreaterThan(0);
    for (const [name, value] of observed) {
      expect(declared.has(value as string), `${name} (${String(value)})`).toBe(true);
    }
  });

  it("agrees with core on the transitional statuses and the held hold values", () => {
    expect([...devtools.TRANSITIONAL_STATUSES].sort()).toEqual(
      [...core.TRANSITIONAL_STATUS_VALUES].sort()
    );
    expect([...devtools.HOLD_VALUES].sort()).toEqual([...core.ANIM_HOLD_PAUSED_VALUES].sort());
  });

  it("builds the same selectors core does", () => {
    expect(devtools.attrSelector(core.SCREEN_ATTR)).toBe(core.attrSelector(core.SCREEN_ATTR));
    expect(devtools.attrValueSelector(core.STATUS_ATTR, "PUSHING")).toBe(
      core.attrValueSelector(core.STATUS_ATTR, "PUSHING")
    );
  });
});

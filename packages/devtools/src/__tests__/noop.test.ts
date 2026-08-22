import { describe, expect, it } from "vitest";

import * as real from "../index";
import * as inert from "../noop";
import { REPORT_SCHEMA_VERSION as RECORDER_VERSION } from "../recorder";

// The production entry (src/noop.ts) is what `exports`'s `production`
// condition resolves to. Two things have to stay true about it, and neither is
// visible at the call site — a drift here breaks consumers only in production
// builds, which is the failure mode this whole design exists to remove.

describe("production entry", () => {
  it("exports every runtime name the real entry does", () => {
    const runtimeNames = (module: Record<string, unknown>) =>
      Object.keys(module)
        .filter((key) => typeof module[key] !== "undefined")
        .sort();

    const missing = runtimeNames(real).filter((name) => !(name in inert));
    // A name added to index.ts and forgotten in noop.ts would surface as
    // "export not found" during a consumer's production build only.
    expect(missing, "names present in the real entry but missing from noop").toEqual([]);
  });

  it("reports the same schema version as the recorder", () => {
    // noop.ts duplicates the constant rather than importing it, which would
    // pull the recorder back into the production graph.
    expect(inert.REPORT_SCHEMA_VERSION).toBe(RECORDER_VERSION);
  });

  it("returns a report that satisfies the public contract, field by field", () => {
    // The gap that shipped: the inert report omitted whole sections behind an
    // `as unknown as FlemoReport` cast. Types resolve to index.d.ts under
    // every export condition, so `report().environment.engine` type-checked
    // and threw only in a production build. Reaching THROUGH each section is
    // what catches that; checking a couple of arrays does not.
    const report = inert.attachFlightRecorder().report();

    expect(report.environment.engine).toBe("unknown");
    expect(report.environment.observation.longTasks).toBe(false);
    expect(report.environment.rafCadence.medianGapMs).toBeNull();
    expect(report.environment.screen.width).toBe(0);
    expect(report.overrides.active).toEqual({});

    // Every key the real report carries must be present, so a section added
    // to FlemoReport cannot be forgotten here without the compiler or this
    // test noticing.
    const realKeys = Object.keys(real.attachFlightRecorder().report()).sort();
    expect(Object.keys(report).sort()).toEqual(realKeys);
  });

  it("records nothing and says so, rather than fabricating a report", () => {
    const handle = inert.attachFlightRecorder({ log: true });
    const report = handle.report();

    expect(report.flights).toEqual([]);
    expect(report.version).toBe("inert");
    // The report must announce its own emptiness: a silent empty report reads
    // as "clean run" to whoever receives it.
    expect(report.anomalies.join(" ")).toContain("production entry");
    expect(() => handle.detach()).not.toThrow();
  });

  it("attaches no panel and touches no DOM", () => {
    const before = document.body.innerHTML;
    const panel = inert.attachDevtoolsPanel();
    expect(document.body.innerHTML).toBe(before);
    expect(() => panel.detach()).not.toThrow();
  });

  it("keeps the pure analysis helpers real, not stubbed", () => {
    // These are re-exported as-is: they touch no DOM, so there is nothing to
    // neutralise, and stubbing them would make the two entries disagree.
    expect(inert.LONG_GAP_MS).toBe(real.LONG_GAP_MS);
    expect(inert.BLIND_SPOTS).toEqual(real.BLIND_SPOTS);
    expect(inert.parseTranslateX("translateX(12px)")).toBe(
      real.parseTranslateX("translateX(12px)")
    );
  });
});

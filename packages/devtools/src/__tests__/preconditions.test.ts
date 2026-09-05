import { describe, expect, it } from "vitest";

import { derivePreconditions } from "../preconditions";

import type { EnvironmentFingerprint, Precondition } from "../types";

// A NUMBER IS ONLY EVIDENCE IF THE SESSION IT CAME FROM WAS ALLOWED TO PRODUCE
// ONE. Each check below exists because its absence cost this project a
// campaign, and each one is asserted on the SUBSTANCE of what it says, not
// just on its status: the detail is the half a reader acts on.

const environment = (over: Partial<EnvironmentFingerprint> = {}): EnvironmentFingerprint => ({
  userAgent: "test",
  uaBrands: null,
  engine: "webkit",
  platform: "iPhone",
  maxTouchPoints: 5,
  devicePixelRatio: 3,
  hardwareConcurrency: 6,
  screen: { width: 390, height: 844 },
  viewport: { width: 390, height: 844 },
  visualViewportScale: 1,
  rafCadence: { medianGapMs: 16.7, sampleCount: 20 },
  reducedMotion: false,
  developmentHints: [],
  emulationSuspected: false,
  observation: { longTasks: true, elementAnimations: true, animationEvents: true },
  ...over
});

const check = (list: Precondition[], id: string): Precondition => {
  const found = list.find((entry) => entry.id === id);
  if (!found) throw new Error(`no precondition ${id}`);
  return found;
};

const derive = (over: Partial<Parameters<typeof derivePreconditions>[0]> = {}) =>
  derivePreconditions({
    environment: environment(),
    idleLongTasks: [],
    observedMs: 10_000,
    wentHidden: false,
    documentHidden: false,
    input: { trusted: 2, synthetic: 0, pointerTypes: ["touch"] },
    ...over
  });

describe("the observable half of the judging protocol", () => {
  it("passes a clean session on every check it can make", () => {
    const list = derive();
    expect(list.filter((entry) => entry.status === "violated")).toEqual([]);
    expect(check(list, "display-cadence").status).toBe("ok");
    expect(check(list, "real-input").status).toBe("ok");
    expect(check(list, "touch-path").status).toBe("ok");
  });

  it("keeps the traps a page cannot see as UNKNOWN rather than guessing them", () => {
    const list = derive();
    for (const id of ["devtools-closed", "no-screen-capture", "viewing-configuration"]) {
      expect(check(list, id).status).toBe("unknown");
    }
    expect(check(list, "devtools-closed").detail).toContain("Confirm it with the user");
  });

  it("reads a half-rate clock as the Low Power Mode ceiling, not as a defect", () => {
    const list = derive({
      environment: environment({ rafCadence: { medianGapMs: 33.3, sampleCount: 20 } })
    });
    const cadence = check(list, "display-cadence");
    expect(cadence.status).toBe("violated");
    expect(cadence.detail).toContain("Low Power Mode");
    expect(cadence.detail).toContain("not a library defect");
    expect(cadence.metrics).toEqual({ medianIdleFrameMs: 33.3 });
  });

  it("reads a display above 60Hz as fine, and says the budget is still 60Hz", () => {
    const cadence = check(
      derive({ environment: environment({ rafCadence: { medianGapMs: 8.3, sampleCount: 20 } }) }),
      "display-cadence"
    );
    expect(cadence.status).toBe("ok");
    expect(cadence.detail).toContain("above 60Hz");
  });

  it("reads a starved page as something else owning the machine", () => {
    const cadence = check(
      derive({ environment: environment({ rafCadence: { medianGapMs: 120, sampleCount: 20 } }) }),
      "display-cadence"
    );
    expect(cadence.status).toBe("violated");
    expect(cadence.detail).toContain("owns this machine");
  });

  it("admits it does not know the cadence when it could not be sampled", () => {
    expect(
      check(
        derive({
          environment: environment({ rafCadence: { medianGapMs: null, sampleCount: 0 } })
        }),
        "display-cadence"
      ).status
    ).toBe("unknown");
  });

  it("calls a busy machine what it is: someone else's load", () => {
    const contention = check(
      derive({
        idleLongTasks: [
          { startMs: 100, durationMs: 240 },
          { startMs: 800, durationMs: 300 }
        ]
      }),
      "machine-idle"
    );
    expect(contention.status).toBe("violated");
    expect(contention.detail).toContain("measures the load");
    expect(contention.metrics).toEqual({
      idleLongTasks: 2,
      idleLongTaskMs: 540,
      worstIdleTaskMs: 300
    });
  });

  it("says nothing about contention in a browser that cannot report it", () => {
    const contention = check(
      derive({
        environment: environment({
          observation: { longTasks: false, elementAnimations: true, animationEvents: true }
        })
      }),
      "machine-idle"
    );
    expect(contention.status).toBe("unknown");
  });

  it("flags a development build, and never claims a production one", () => {
    const dev = check(
      derive({ environment: environment({ developmentHints: ["__NEXT_HMR_CB"] }) }),
      "build-mode"
    );
    expect(dev.status).toBe("violated");
    expect(dev.detail).toContain("__NEXT_HMR_CB");

    const quiet = check(derive(), "build-mode");
    expect(quiet.status).toBe("unknown");
    expect(quiet.detail).toContain("does not prove one");
  });

  it("refuses a session driven by script dispatch", () => {
    const input = check(
      derive({ input: { trusted: 0, synthetic: 5, pointerTypes: ["mouse"] } }),
      "real-input"
    );
    expect(input.status).toBe("violated");
    expect(input.detail).toContain("never fires the gesture machinery");
  });

  it("says so when nothing drove the navigations at all", () => {
    const input = check(
      derive({ input: { trusted: 0, synthetic: 0, pointerTypes: [] } }),
      "real-input"
    );
    expect(input.status).toBe("unknown");
    expect(input.detail).toContain("back/forward");
  });

  it("names a mouse-only session on a touch device as an untested path", () => {
    const touch = check(
      derive({ input: { trusted: 4, synthetic: 0, pointerTypes: ["mouse"] } }),
      "touch-path"
    );
    expect(touch.status).toBe("unknown");
    expect(touch.detail).toContain("passed every automated layer green");
  });

  it("has nothing to say about touch on a device with none", () => {
    const touch = check(
      derive({
        environment: environment({ maxTouchPoints: 0 }),
        input: { trusted: 4, synthetic: 0, pointerTypes: ["mouse"] }
      }),
      "touch-path"
    );
    expect(touch.status).toBe("unknown");
    expect(touch.detail).toContain("no touch points");
  });

  it("flags a hidden document, now or at any point while recording", () => {
    expect(check(derive({ documentHidden: true }), "page-foreground").detail).toContain(
      "HIDDEN right now"
    );
    expect(check(derive({ wentHidden: true }), "page-foreground").detail).toContain(
      "hidden at least once"
    );
  });

  it("flags emulation, and hedges it on Windows where touch is ambiguous", () => {
    const mac = check(
      derive({ environment: environment({ emulationSuspected: true }) }),
      "device-emulation"
    );
    expect(mac.status).toBe("violated");
    expect(mac.detail).not.toContain("Windows touch hardware");

    const windows = check(
      derive({
        environment: environment({ emulationSuspected: true, platform: "Win32" })
      }),
      "device-emulation"
    );
    expect(windows.detail).toContain("Windows touch hardware");
  });

  it("flags reduced motion as the transitions not being the ones under test", () => {
    const reduced = check(
      derive({ environment: environment({ reducedMotion: true }) }),
      "reduced-motion"
    );
    expect(reduced.status).toBe("violated");
    expect(reduced.detail).toContain("not the motion being judged");
  });

  it("says the pointer type was unreported rather than printing an empty list", () => {
    const input = check(
      derive({ input: { trusted: 3, synthetic: 0, pointerTypes: [] } }),
      "real-input"
    );
    expect(input.status).toBe("ok");
    expect(input.detail).toContain("type unreported");
  });
});

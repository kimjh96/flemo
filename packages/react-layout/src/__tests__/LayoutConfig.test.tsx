import { useContext } from "react";

import { render } from "@testing-library/react";
import { MotionConfigContext } from "motion/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TaskManger } from "@flemo/core";

import { Route, Router, Screen } from "@flemo/react";

import LayoutConfig from "../LayoutConfig";

const startManualGateSweeper = () => {
  let sweeping = true;
  const sweeper = (async () => {
    while (sweeping) {
      await new Promise((resolve) => setTimeout(resolve, 8));
      await TaskManger.resolveAllPending();
    }
  })();
  return async () => {
    sweeping = false;
    await sweeper;
  };
};

let stopSweeper: () => Promise<void>;
beforeEach(() => {
  stopSweeper = startManualGateSweeper();
  window.history.replaceState(null, "", "/");
});
afterEach(async () => {
  await stopSweeper();
});

type MotionConfigValue = {
  transition?: { duration?: number; layout?: { duration?: number } };
  reducedMotion?: string;
};

const renderProbe = (extraProps: Record<string, unknown> = {}) => {
  let config: MotionConfigValue | null = null;
  function Probe() {
    config = useContext(MotionConfigContext) as MotionConfigValue;
    return <div data-testid="probe" />;
  }

  const result = render(
    <Router initPath="/">
      <Route
        path="/"
        element={
          <Screen>
            <LayoutConfig {...extraProps}>
              <Probe />
            </LayoutConfig>
          </Screen>
        }
      />
    </Router>
  );

  return { ...result, config: () => config };
};

describe("LayoutConfig", () => {
  it("renders its children under a MotionConfig", () => {
    const { getByTestId, config } = renderProbe();

    expect(getByTestId("probe")).toBeDefined();
    expect(config()).not.toBeNull();
  });

  it("mirrors the current flemo variant's timing into transition.layout", () => {
    // The root screen sits at IDLE-true of the "none" transition, whose idle
    // variant is { duration: 0 }. motion's layout engine only honors
    // `transition.layout`, so LayoutConfig must mirror the options there —
    // otherwise layout morphs fall back to motion's default spring.
    const { config } = renderProbe();

    const transition = config()!.transition;
    expect(transition).toBeDefined();
    expect(transition!.duration).toBe(0);
    expect(transition!.layout).toBeDefined();
    expect(transition!.layout!.duration).toBe(0);
  });

  it("passes other MotionConfig props through", () => {
    const { config } = renderProbe({ reducedMotion: "always" });

    expect(config()!.reducedMotion).toBe("always");
  });
});

import { useState } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTransition } from "@flemo/core";

import Screen from "@screen/Screen";

import Route from "@Route";

import Router from "../Router";

// A NESTED ROUTER THAT MOUNTS LATE NAMES ITS OWN TRANSITION.
//
// The docs on flemo.dev are a nested Router whose default is its own
// `doc-forward`. Reached from the home page, it mounts after the site's Router
// has registered, so its first screen rendered before its own registration ran
// and resolved `doc-forward` into a map holding only the site's names: a
// development error for a transition that was registered one effect later.

const fade = (name: string) =>
  createTransition({
    name: name as never,
    initial: { opacity: 0 },
    idle: { value: { opacity: 1 }, options: { duration: 0 } },
    enter: { value: { opacity: 1 }, options: { duration: 0.2 } },
    enterBack: { value: { opacity: 0 }, options: { duration: 0.2 } },
    exit: { value: { opacity: 0 }, options: { duration: 0.2 } },
    exitBack: { value: { opacity: 1 }, options: { duration: 0.2 } }
  });

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

const reported = (name: string) =>
  consoleError.mock.calls.some((args: unknown[]) =>
    String(args[0]).includes(`No transition is registered under "${name}"`)
  );

let mountNested: () => void = () => {};

function Outer({ nestedDefault, nested }: { nestedDefault: string; nested: string }) {
  const [shown, setShown] = useState(false);
  mountNested = () => setShown(true);
  return (
    <Screen>
      {shown && (
        <Router
          initPath="/inner"
          history="memory"
          transitions={[fade(nested)]}
          defaultTransitionName={nestedDefault as never}
        >
          <Route path="/inner" element={<Screen>inner</Screen>} />
        </Router>
      )}
    </Screen>
  );
}

const renderLate = (nestedDefault: string, nested: string, outer: string) => {
  const view = render(
    <Router initPath="/" history="memory" transitions={[fade(outer)]}>
      <Route path="/" element={<Outer nestedDefault={nestedDefault} nested={nested} />} />
    </Router>
  );
  act(() => mountNested());
  return view;
};

describe("a nested Router mounted after another has registered", () => {
  it("does not report its own default transition as unregistered", () => {
    const view = renderLate("late-own", "late-own", "late-outer-a");
    expect(view.getByText("inner")).toBeDefined();
    expect(reported("late-own")).toBe(false);
  });

  it("still reports a default that no Router registered", () => {
    renderLate("late-missing", "late-registered", "late-outer-b");
    expect(reported("late-missing")).toBe(true);
  });
});

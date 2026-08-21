import { useState, type ReactNode } from "react";

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// A screen frozen by <Activity> keeps its React state but loses its effects —
// including the visual-viewport subscription behind the keyboard heuristic.
// A screen covered while the keyboard was open therefore used to wake up still
// believing it was open, and its shared bottom bar stayed display:none for the
// rest of its life (the close event fired while it was frozen, and nothing else
// ever reports). Browser-verified on the real symptom: push into a screen with
// a focused input, pop back, tab bar gone.

let stores: FlemoStores;
let listeners: Map<string, EventListener>;
let frames: FrameRequestCallback[];
let viewportHeight: number;

beforeEach(() => {
  stores = createTestStores();
  stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
  listeners = new Map();
  frames = [];
  viewportHeight = 800; // document is 800 tall → no shortfall
  vi.stubGlobal("requestAnimationFrame", (frameCallback: FrameRequestCallback) => {
    frames.push(frameCallback);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      get height() {
        return viewportHeight;
      },
      addEventListener: (type: string, listener: EventListener) => {
        listeners.set(type, listener);
      },
      removeEventListener: (type: string) => {
        listeners.delete(type);
      }
    }
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: 800
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const screenContext = (overrides: Partial<ScreenContextProps>): ScreenContextProps => ({
  id: "home",
  isActive: true,
  isRoot: true,
  isPrev: false,
  zIndex: 0,
  pathname: "/",
  params: {},
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  layoutId: null,
  routePath: "/",
  ...overrides
});

// The stack: "home" carries the shared bottom bar and gets covered; "top" is
// the screen above it, which stays live and keeps observing the viewport (as
// the active screen of a real stack always does).
function Stack({ covered }: { covered: boolean }) {
  return (
    <StoreContext.Provider value={stores}>
      <ScreenContext.Provider
        value={screenContext({ isActive: !covered, isPrev: covered, zIndex: 0 })}
      >
        <Screen sharedBottomBar={<div>tabs</div>}>
          <div>home</div>
        </Screen>
      </ScreenContext.Provider>
      {covered && (
        <ScreenContext.Provider value={screenContext({ id: "top", isActive: true, zIndex: 2 })}>
          <Screen>
            <div>top</div>
          </Screen>
        </ScreenContext.Provider>
      )}
    </StoreContext.Provider>
  );
}

function Harness({ children }: { children?: ReactNode }): ReactNode {
  return children;
}

const fireViewportChange = async () => {
  await act(async () => {
    listeners.get("resize")?.(new Event("resize"));
    frames.splice(0).forEach((frameCallback) => frameCallback(0));
  });
};

describe("a covered screen waking after the keyboard closed", () => {
  it("shows its shared bottom bar again", async () => {
    function App() {
      const [covered, setCovered] = useState(false);
      (App as unknown as { cover: (next: boolean) => void }).cover = setCovered;
      return <Stack covered={covered} />;
    }

    const { container } = render(
      <Harness>
        <App />
      </Harness>
    );
    const bar = () => container.querySelector<HTMLElement>('[data-flemo-bar="nav"]')!;

    expect(bar().style.display).not.toBe("none");

    // The keyboard opens while home is still live: it hides its bottom bar.
    viewportHeight = 500;
    await fireViewportChange();
    expect(bar().style.display).toBe("none");

    // Home is covered (deep → frozen in this very commit), so its viewport
    // subscription goes away while its state survives.
    stores.history.setState({ index: 2 });
    await act(async () => {
      (App as unknown as { cover: (next: boolean) => void }).cover(true);
    });

    // The keyboard closes while home is frozen — only the live screen above
    // observes it.
    viewportHeight = 800;
    await fireViewportChange();

    // Home comes back. Its bar must return with it.
    stores.history.setState({ index: 0 });
    await act(async () => {
      (App as unknown as { cover: (next: boolean) => void }).cover(false);
    });

    expect(bar().style.display).not.toBe("none");
  });
});

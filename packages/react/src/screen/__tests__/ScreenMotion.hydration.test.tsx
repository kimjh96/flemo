import { act, useLayoutEffect, type PropsWithChildren, type ReactNode } from "react";

import { createRoot, hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { createHistoryStore, type History, type TransitionName } from "@flemo/core";

import Screen from "@screen/Screen";
import ScreenContext, { type ScreenContextProps } from "@screen/ScreenContext";

import { createTestStores } from "@stores/__tests__/testUtils";
import StoreContext, { type FlemoStores } from "@stores/StoreContext";

// SSR hydration contract for the screen scope's layer promotion.
//
// The scope's REST `will-change: transform` is the only flemo decision that is
// BOTH browser-derived (the `flemo:preraster` session key) and rendered as an
// INLINE STYLE — so evaluating it in the hydration render made the server HTML
// ("no will-change") disagree with the client VDOM ("willChange: transform")
// and React reported a style mismatch on [data-flemo-screen]. The fix defers
// the read past hydration (useHydrationSafeFlag): server and first client
// render are identical by construction, and the promotion lands one commit
// later.
let stores: FlemoStores;

const ENTRY: History = {
  id: "screen-1",
  pathname: "/posts/1",
  params: { id: "1" },
  transitionName: "cupertino" as TransitionName
};

const SCREEN: ScreenContextProps = {
  id: "screen-1",
  isActive: true,
  isRoot: true,
  isPrev: false,
  zIndex: 0,
  pathname: "/posts/1",
  params: { id: "1" },
  transitionName: "cupertino" as TransitionName,
  prevTransitionName: "cupertino" as TransitionName,
  routePath: "/posts/:id"
};

// One tree, rendered by BOTH react-dom/server and the hydrating client — the
// only way the comparison means anything.
function App({ children }: PropsWithChildren): ReactNode {
  return (
    <StoreContext.Provider value={stores}>
      <ScreenContext.Provider value={SCREEN}>
        <Screen>{children ?? <div data-testid="content">hello</div>}</Screen>
      </ScreenContext.Provider>
    </StoreContext.Provider>
  );
}

const scopeOf = (host: HTMLElement) => host.querySelector<HTMLElement>("[data-flemo-screen]")!;

describe("ScreenMotion SSR hydration", () => {
  let host: HTMLDivElement;
  let root: Root | null;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let recoverable: Mock<(error: unknown) => void>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    sessionStorage.clear();
    // SEEDED at creation, the way <Router> seeds its scope from initPath —
    // zustand hands React `getInitialState()` as the SSR snapshot AND as the
    // hydration snapshot, so a store mutated afterwards would make both sides
    // read the pre-mutation stack and mask the very divergence under test.
    // Seeded, the per-screen half of the promotion predicate (`zIndex === index`)
    // is identical on both sides and the browser flag is the only variable left.
    stores = { ...createTestStores(), history: createHistoryStore([ENTRY], 0) };
    stores.navigate.setState({ status: "COMPLETED", transitionTaskId: null });
    host = document.createElement("div");
    document.body.appendChild(host);
    root = null;
    recoverable = vi.fn<(error: unknown) => void>();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    host.remove();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  /** Render the server HTML for the CURRENT (server-shaped) environment. */
  const renderServerHtml = () => renderToString(<App />);

  /** Hydrate that HTML, returning the scope element. */
  const hydrate = (html: string) => {
    host.innerHTML = html;
    act(() => {
      root = hydrateRoot(host, <App />, { onRecoverableError: recoverable });
    });
    return scopeOf(host);
  };

  const expectSilentHydration = () => {
    expect(recoverable).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  };

  it("never emits the browser-derived promotion into the server HTML", () => {
    // Armed BEFORE the server render: even where the storage happens to be
    // readable (this jsdom process is both "server" and "client"), the SSR
    // snapshot must stay the deterministic one, or a real Node server and a
    // flagged browser diverge.
    sessionStorage.setItem("flemo:preraster", "on");

    expect(renderServerHtml()).not.toContain("will-change");
  });

  it("hydrates without a mismatch when flemo:preraster is armed in the browser only", () => {
    // Server: no browser state at all.
    const html = renderServerHtml();
    expect(html).not.toContain("will-change");

    // Browser: the flag the user actually reported this with.
    sessionStorage.setItem("flemo:preraster", "on");

    const scope = hydrate(html);
    expectSilentHydration();
    // …and the optimization still arrives, one commit past hydration.
    expect(scope.style.willChange).toBe("transform");
  });

  it("promotes nothing when the session is not eligible", () => {
    const scope = hydrate(renderServerHtml());

    expectSilentHydration();
    expect(scope.style.willChange).toBe("");
  });

  it("keeps the promotion on a client-mounted screen's FIRST commit", () => {
    // A screen mounted by a push/replace/pop is not hydrating, so it must read
    // the live value in render — deferring it there would lose the layer on
    // exactly the opening frames the promotion exists for. Probed from a layout
    // effect: the DOM is committed, and the hook's post-mount re-render (a
    // passive effect) has not run yet.
    sessionStorage.setItem("flemo:preraster", "on");
    let firstCommit: string | null = null;

    function Probe() {
      useLayoutEffect(() => {
        firstCommit = scopeOf(host).style.willChange;
      }, []);
      return null;
    }

    act(() => {
      root = createRoot(host);
      root.render(
        <App>
          <Probe />
        </App>
      );
    });

    expect(firstCommit).toBe("transform");
  });
});

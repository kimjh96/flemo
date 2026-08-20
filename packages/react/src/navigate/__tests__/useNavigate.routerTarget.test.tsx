import { act, cleanup, render } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskManger, type FlemoStores } from "@flemo/core";

import useNavigate from "@navigate/useNavigate";

import Route from "@Route";
import Router from "@Router";
import useStores from "@stores/useStores";

import Slot from "../../Slot";

// Cross-Router navigation: a nested <Router> whose screens need to move the
// Router ABOVE them (open a full-screen detail from inside a tab region)
// instead of stacking inside their own <Slot>.
//
// The tree below is the shape that motivated the API — an app Router with a
// contained "region" Router in one of its screens, plus a third level so
// `root` is genuinely distinguishable from `parent`:
//
//   <Router name="app">                    browser history, full viewport
//     /, /members/:id, [/region, /region/people]
//     └── <Router name="region">           memory history, contained region
//           /region, /region/people
//           └── <Router name="inner">      memory history, contained region
//                 /inner, /inner/detail
declare module "@Route" {
  interface RegisterRoute {
    "/": Record<string, never>;
    "/members/:id": { id: string };
    "/region": Record<string, never>;
    "/region/people": Record<string, never>;
    "/inner": Record<string, never>;
    "/inner/detail": Record<string, never>;
  }
}

// Every navigation parks a manual-gated task that ScreenMotion resolves from
// `animationend` at runtime. jsdom has no animation, so sweep the gate.
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

type Navigate = ReturnType<typeof useNavigate>;

const captured: {
  app: FlemoStores;
  region: FlemoStores;
  inner: FlemoStores;
  appNav: Navigate;
  regionNav: Navigate;
  regionParentNav: Navigate;
  regionAppNav: Navigate;
  innerNav: Navigate;
  innerParentNav: Navigate;
  innerRootNav: Navigate;
  innerOwnerNav: Navigate;
} = {} as never;

function AppChrome() {
  captured.app = useStores();
  captured.appNav = useNavigate();
  return null;
}

function InnerPanel() {
  captured.inner = useStores();
  captured.innerNav = useNavigate();
  captured.innerParentNav = useNavigate({ router: "parent" });
  captured.innerRootNav = useNavigate({ router: "root" });
  captured.innerOwnerNav = useNavigate({ router: "nearest-owner" });
  return <div>inner</div>;
}

function RegionFeed() {
  captured.region = useStores();
  captured.regionNav = useNavigate();
  captured.regionParentNav = useNavigate({ router: "parent" });
  captured.regionAppNav = useNavigate({ router: "app" });

  return (
    <div>
      feed
      <Router name="inner" history="memory" initPath="/inner">
        <Route path="/inner" element={<InnerPanel />} />
        <Route path="/inner/detail" element={<div>inner detail</div>} />
      </Router>
    </div>
  );
}

function RegionActivity() {
  return (
    <Router name="region" history="memory" initPath="/region">
      <div>region header</div>
      <Slot>
        <Route path="/region" element={<RegionFeed />} />
        <Route path="/region/people" element={<div>region people</div>} />
      </Slot>
    </Router>
  );
}

function App() {
  return (
    <Router name="app" initPath="/">
      <AppChrome />
      <Slot>
        <Route path="/" element={<div>home</div>} />
        <Route path="/members/:id" element={<div>member</div>} />
        <Route path={["/region", "/region/people"]} element={<RegionActivity />} />
      </Slot>
    </Router>
  );
}

const pathnames = (stores: FlemoStores) =>
  stores.history.getState().histories.map((entry) => entry.pathname);

const status = (stores: FlemoStores) => stores.navigate.getState().status;

// Navigations settle through the task queue and flip store state, so run them
// inside act() to keep React's updates flushed.
const run = (navigation: () => Promise<unknown>) => act(async () => void (await navigation()));

let stopSweeper: () => Promise<void>;

beforeEach(() => {
  // Mount the app on the region screen, so all three Routers are live.
  window.history.replaceState(null, "", "/region");
  stopSweeper = startManualGateSweeper();
  render(<App />);
});

afterEach(async () => {
  await stopSweeper();
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("useNavigate: target Router selection", () => {
  it("defaults to the nearest Router (unchanged behavior)", async () => {
    await run(() => captured.regionNav.push("/region/people"));

    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
    expect(pathnames(captured.app)).toEqual(["/region"]);
  });

  it('router: "parent" runs the navigation on the enclosing Router', async () => {
    await run(() => captured.regionNav.push("/members/:id", { id: "7" }, { router: "parent" }));

    expect(pathnames(captured.app)).toEqual(["/region", "/members/7"]);
    expect(pathnames(captured.region)).toEqual(["/region"]);
  });

  it('router: "root" reaches the outermost Router from two levels down', async () => {
    // From `inner`, "parent" is the region Router and "root" is the app one.
    await run(() => captured.innerParentNav.push("/region/people"));
    await run(() => captured.innerRootNav.push("/members/:id", { id: "9" }));

    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
    expect(pathnames(captured.app)).toEqual(["/region", "/members/9"]);
    expect(pathnames(captured.inner)).toEqual(["/inner"]);
  });

  it("finds a Router by name anywhere in the enclosing chain", async () => {
    await run(() => captured.innerNav.push("/members/:id", { id: "3" }, { router: "app" }));
    await run(() => captured.innerNav.push("/region/people", undefined, { router: "region" }));

    expect(pathnames(captured.app)).toEqual(["/region", "/members/3"]);
    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
  });

  it("applies the hook-level default target to every call it returns", async () => {
    await run(() => captured.regionAppNav.push("/members/:id", { id: "1" }));

    expect(pathnames(captured.app)).toEqual(["/region", "/members/1"]);
    expect(pathnames(captured.region)).toEqual(["/region"]);
  });

  it("lets a per-call target override the hook-level default", async () => {
    // The hook is bound to "app"; this one call goes back to the current Router.
    await run(() => captured.regionAppNav.push("/region/people", undefined, { router: "current" }));

    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
    expect(pathnames(captured.app)).toEqual(["/region"]);
  });

  it("selects the named Router even when current and parent both own the path", async () => {
    // "/region/people" is declared by BOTH the app Router (it mounts the whole
    // region) and the region Router (it swaps the contained panel).
    await run(() => captured.regionNav.push("/region/people"));
    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
    expect(pathnames(captured.app)).toEqual(["/region"]);

    await run(() => captured.regionNav.push("/region/people", undefined, { router: "parent" }));
    expect(pathnames(captured.app)).toEqual(["/region", "/region/people"]);
  });

  it('router: "nearest-owner" walks out to the Router that declares the path', async () => {
    // The hook is bound to "nearest-owner": /inner/detail stays local, while
    // /members/:id walks past region up to the app Router.
    await run(() => captured.innerOwnerNav.push("/inner/detail"));
    await run(() => captured.innerOwnerNav.push("/members/:id", { id: "4" }));

    expect(pathnames(captured.inner)).toEqual(["/inner", "/inner/detail"]);
    expect(pathnames(captured.app)).toEqual(["/region", "/members/4"]);
    expect(pathnames(captured.region)).toEqual(["/region"]);
  });
});

describe("useNavigate: which Router transitions", () => {
  it("a current-Router move transitions only inside the Slot", async () => {
    await run(() => captured.regionNav.push("/region/people"));

    // The region ran a flight; the outer Router never left IDLE, so its screen
    // (and the region header above the Slot) never transitioned.
    expect(status(captured.region)).toBe("COMPLETED");
    expect(status(captured.app)).toBe("IDLE");
  });

  it("a parent move transitions the whole outer screen", async () => {
    await run(() => captured.regionNav.push("/members/:id", { id: "7" }, { router: "parent" }));

    expect(status(captured.app)).toBe("COMPLETED");
    expect(status(captured.region)).toBe("IDLE");
  });
});

describe("useNavigate: history backends across the boundary", () => {
  it("a nested memory Router can drive its parent browser Router", async () => {
    // The region's own stack never touches the URL...
    await run(() => captured.regionNav.push("/region/people"));
    expect(window.location.pathname).toBe("/region");

    // ...but a parent-targeted move runs on the browser driver.
    await run(() => captured.regionNav.push("/members/:id", { id: "7" }, { router: "parent" }));
    expect(window.location.pathname).toBe("/members/7");
  });

  it("keeps the nested Router's stack when the parent moves away and back", async () => {
    await run(() => captured.regionNav.push("/region/people"));
    await run(() => captured.regionNav.push("/members/:id", { id: "7" }, { router: "parent" }));

    // Back to the region screen (the same path a browser Back takes through
    // HistoryListener → the parent Router's pop).
    await run(() => captured.regionNav.pop({ router: "parent" }));

    expect(pathnames(captured.app)).toEqual(["/region"]);
    expect(pathnames(captured.region)).toEqual(["/region", "/region/people"]);
  });
});

describe("useNavigate: options on the selected Router", () => {
  it("applies transitionName on the target Router's entry", async () => {
    await run(() =>
      captured.regionNav.push(
        "/members/:id",
        { id: "7" },
        { router: "parent", transitionName: "material" }
      )
    );

    const { histories, index } = captured.app.history.getState();
    expect(histories[index]!.transitionName).toBe("material");
  });

  it("targets push, replace and pop independently", async () => {
    await run(() => captured.regionNav.push("/members/:id", { id: "1" }, { router: "app" }));
    await run(() => captured.regionNav.replace("/members/:id", { id: "2" }, { router: "app" }));
    expect(pathnames(captured.app)).toEqual(["/region", "/members/2"]);

    // The region's own stack is untouched by all of it, and its pop stays local.
    await run(() => captured.regionNav.push("/region/people"));
    await run(() => captured.regionNav.pop());
    expect(pathnames(captured.region)).toEqual(["/region"]);

    await run(() => captured.regionNav.pop({ router: "app" }));
    expect(pathnames(captured.app)).toEqual(["/region"]);
  });
});

describe("useNavigate: development diagnostics", () => {
  it("throws when the named target does not declare the route", () => {
    expect(() =>
      captured.regionNav.push("/members/:id", { id: "1" }, { router: "current" })
    ).toThrow(/"\/members\/:id" is not declared/);
  });

  it("throws for a Router name that is not in the chain", () => {
    expect(() =>
      captured.regionNav.push("/region/people", undefined, { router: "sidebar" })
    ).toThrow(/no <Router name="sidebar">/);
  });

  it('throws for router: "parent" at the outermost Router', () => {
    // Relative targets always resolve from where the hook was CALLED, never
    // from the hook's own default target: this one lives in the app Router's
    // chrome, which has nothing above it.
    expect(() =>
      captured.appNav.push("/members/:id", { id: "1" }, { router: { scope: "parent" } })
    ).toThrow(/no parent Router/);
  });

  it("warns but keeps the legacy behavior when an implicit target lacks the route", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    await run(() => captured.regionNav.push("/members/:id", { id: "1" }));

    expect(spy).toHaveBeenCalledWith(expect.stringContaining("is not declared"));
    // Unchanged: the navigation still ran on the nearest Router.
    expect(pathnames(captured.region)).toEqual(["/region", "/members/1"]);
  });
});

describe("Router name diagnostics", () => {
  it("reports a duplicate name in the same chain", () => {
    cleanup();
    window.history.replaceState(null, "", "/");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <Router name="app" initPath="/">
        <Route
          path="/"
          element={
            <Router name="app" history="memory" initPath="/inner">
              <Route path="/inner" element={<div>inner</div>} />
            </Router>
          }
        />
      </Router>
    );

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('duplicate <Router name="app">'));
  });
});

describe("Router scope chain: SSR", () => {
  it("hydrates a named, nested Router tree without a mismatch", async () => {
    cleanup();
    window.history.replaceState(null, "", "/region");

    const html = renderToString(<App />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      hydrateRoot(container, <App />);
    });

    expect(spy).not.toHaveBeenCalled();
    document.body.removeChild(container);
  });
});

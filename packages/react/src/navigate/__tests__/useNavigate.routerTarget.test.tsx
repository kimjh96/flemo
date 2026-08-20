import { Suspense, startTransition, useLayoutEffect, useState, useSyncExternalStore } from "react";

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

// Registering the names closes the target type: from here on a `router` that
// names no registered Router is a COMPILE error (see the typing block at the
// bottom). "sidebar" is registered but deliberately never rendered in this
// tree, so it stays available as the "valid name, not in this chain" case.
declare module "../../RouterTarget" {
  interface RegisterRouter {
    app: true;
    region: true;
    inner: true;
    sidebar: true;
    "next-name": true;
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

describe("useNavigate: target typing", () => {
  // A TYPE-level contract, enforced by `tsc --noEmit` over this file rather
  // than at runtime: `@ts-expect-error` fails the typecheck if the line it
  // marks ever stops erroring. The body is declared and never called.
  it("closes the target type once Router names are registered", () => {
    const typeOnly = () => {
      const navigate = captured.regionNav;

      // Keywords and registered names.
      navigate.push("/region/people", undefined, { router: "current" });
      navigate.push("/members/:id", { id: "1" }, { router: "parent" });
      navigate.push("/members/:id", { id: "1" }, { router: "root" });
      navigate.push("/members/:id", { id: "1" }, { router: "nearest-owner" });
      navigate.push("/members/:id", { id: "1" }, { router: "app" });
      navigate.push("/members/:id", { id: "1" }, { router: { name: "app" } });
      navigate.push("/members/:id", { id: "1" }, { router: { scope: "parent" } });
      navigate.pop({ router: "app" });

      // @ts-expect-error "nope" names no registered Router
      navigate.push("/members/:id", { id: "1" }, { router: "nope" });
      // @ts-expect-error same, through the object form
      navigate.push("/members/:id", { id: "1" }, { router: { name: "nope" } });
      // @ts-expect-error "grandparent" is not a scope keyword
      navigate.push("/members/:id", { id: "1" }, { router: { scope: "grandparent" } });
      // @ts-expect-error the hook-level default is checked the same way
      useNavigate({ router: "nope" });
    };

    expect(typeof typeOnly).toBe("function");
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

describe("Router scope chain: concurrent rendering", () => {
  // A render can be THROWN AWAY: React renders a transition, something in it
  // suspends, and the previously committed UI keeps running. Anything the
  // discarded render wrote into an object that outlives it is now visible to a
  // tree that never committed those props.
  //
  // The scope node is exactly such an object (the Router owns it for its whole
  // lifetime), so its fields must reflect COMMITTED props only. Otherwise the
  // still-displayed screen resolves `router: "app"` against a name that only
  // exists in a render nobody can see.
  it("keeps the still-displayed tree on the committed name while a transition suspends", async () => {
    cleanup();
    window.history.replaceState(null, "", "/");

    const forever = new Promise<void>(() => {});
    let renameToNext: () => void = () => {};
    let chromeNav: Navigate = null as never;

    function Chrome() {
      chromeNav = useNavigate();
      return null;
    }

    function MaybeSuspend({ suspend }: { suspend: boolean }) {
      if (suspend) throw forever;
      return <div>home</div>;
    }

    function Harness() {
      const [name, setName] = useState("app");
      const [suspend, setSuspend] = useState(false);
      renameToNext = () =>
        startTransition(() => {
          setName("next-name");
          setSuspend(true);
        });

      return (
        <Router name={name} initPath="/">
          <Chrome />
          <Slot>
            <Route
              path="/"
              element={
                <Suspense fallback={<div>loading</div>}>
                  <MaybeSuspend suspend={suspend} />
                </Suspense>
              }
            />
            <Route path="/members/:id" element={<div>member</div>} />
          </Slot>
        </Router>
      );
    }

    render(<Harness />);

    // Rename inside a transition, with the new tree suspending: React keeps
    // showing the committed one, so "app" is still the live Router's name.
    await act(async () => {
      renameToNext();
    });

    expect(() => chromeNav.push("/members/:id", { id: "1" }, { router: "app" })).not.toThrow();
  });
});

describe("Router config: commit-phase publication", () => {
  // Same hazard as the scope node, on the Router's OTHER piece of live config:
  // `defaultTransitionName` is pushed into the transition store, and that store
  // is read by push/replace (event time). A discarded render must not be able
  // to hand a still-displayed screen a transition it never committed to.
  it("keeps the committed default transition while a transition suspends", async () => {
    cleanup();
    window.history.replaceState(null, "", "/");

    const forever = new Promise<void>(() => {});
    let switchDefault: () => void = () => {};
    let chromeNav: Navigate = null as never;
    let chromeStores: FlemoStores = null as never;

    function Chrome() {
      chromeNav = useNavigate();
      chromeStores = useStores();
      return null;
    }

    function MaybeSuspend({ suspend }: { suspend: boolean }) {
      if (suspend) throw forever;
      return <div>home</div>;
    }

    function Harness() {
      const [transitionName, setTransitionName] = useState<"cupertino" | "material">("cupertino");
      const [suspend, setSuspend] = useState(false);
      switchDefault = () =>
        startTransition(() => {
          setTransitionName("material");
          setSuspend(true);
        });

      return (
        <Router defaultTransitionName={transitionName} initPath="/">
          <Chrome />
          <Slot>
            <Route
              path="/"
              element={
                <Suspense fallback={<div>loading</div>}>
                  <MaybeSuspend suspend={suspend} />
                </Suspense>
              }
            />
            <Route path="/members/:id" element={<div>member</div>} />
          </Slot>
        </Router>
      );
    }

    render(<Harness />);

    await act(async () => {
      switchDefault();
    });

    // The screen the user is looking at still belongs to the cupertino render.
    await run(() => chromeNav.push("/members/:id", { id: "1" }));

    const { histories, index } = chromeStores.history.getState();
    expect(histories[index]!.transitionName).toBe("cupertino");
  });
});

describe("Router config: descendant layout effects", () => {
  // React fires layout effects BOTTOM-UP, so a child's runs before the
  // Router's own. Anything the Router publishes from a layout effect is
  // therefore one commit stale for every descendant layout effect — a guard
  // that redirects from useLayoutEffect would resolve `router` against the
  // config of the previous commit. The publication has to land earlier in the
  // commit than any layout effect.
  it("lets a descendant layout effect see the config committed in the same commit", async () => {
    cleanup();
    window.history.replaceState(null, "", "/");

    let thrown: unknown = null;
    let arm: () => void = () => {};

    function LayoutNavigator({ armed }: { armed: boolean }) {
      const navigate = useNavigate();
      useLayoutEffect(() => {
        if (!armed) return;
        try {
          void navigate.push("/members/:id", { id: "1" }, { router: "next-name" });
        } catch (error) {
          thrown = error;
        }
      }, [armed, navigate]);
      return null;
    }

    function Harness() {
      const [name, setName] = useState("app");
      const [armed, setArmed] = useState(false);
      // One commit renames the Router AND arms the descendant's layout effect.
      arm = () => {
        setName("next-name");
        setArmed(true);
      };

      return (
        <Router name={name} initPath="/">
          <LayoutNavigator armed={armed} />
          <Slot>
            <Route path="/" element={<div>home</div>} />
            <Route path="/members/:id" element={<div>member</div>} />
          </Slot>
        </Router>
      );
    }

    render(<Harness />);

    await act(async () => {
      arm();
    });

    expect(thrown).toBeNull();
  });
});

describe("Router config: store notifications", () => {
  // `stores` is public, so a consumer (or a devtools panel) may subscribe to
  // the transition store through React. A store write notifies subscribers
  // synchronously, and a subscriber scheduling a re-render from inside an
  // INSERTION effect is a path React forbids outright.
  it("changes the transition default without scheduling from an insertion effect", async () => {
    cleanup();
    window.history.replaceState(null, "", "/");

    let switchDefault: () => void = () => {};

    function DefaultWatcher() {
      const stores = useStores();
      const read = () => stores.transition.getState().defaultTransitionName;
      const value = useSyncExternalStore(stores.transition.subscribe, read, read);
      return <span data-testid="default">{value}</span>;
    }

    function Harness() {
      const [transitionName, setTransitionName] = useState<"cupertino" | "material">("cupertino");
      switchDefault = () => setTransitionName("material");

      return (
        <Router defaultTransitionName={transitionName} initPath="/">
          <DefaultWatcher />
          <Slot>
            <Route path="/" element={<div>home</div>} />
          </Slot>
        </Router>
      );
    }

    const view = render(<Harness />);
    const errors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(String(args[0]));
    });

    await act(async () => {
      switchDefault();
    });

    expect(errors.filter((message) => message.includes("useInsertionEffect"))).toEqual([]);
    // The subscriber still observes the new default.
    expect(view.getByTestId("default").textContent).toBe("material");
  });
});

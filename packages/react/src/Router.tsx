import {
  Children,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PropsWithChildren,
  type ReactElement,
  type ReactNode
} from "react";

import {
  createBrowserHistoryDriver,
  createRouterScope,
  ensureGpuPipelinePrewarm,
  ensureImageDecodeOffloader,
  isLegacyAndroidBlink,
  readImageOffloadOverride,
  holdCompositorWarm,
  seedRouterEntry,
  isServer,
  type HistoryDriver,
  type PartTransition,
  type Decorator,
  type Transition,
  type TransitionName
} from "@flemo/core";

import HistoryListener from "@history/HistoryListener";

import Renderer from "@renderer/Renderer";

import ScreenContext from "@screen/ScreenContext";

import ScreenViewportContext from "@screen/ScreenViewportContext";

import useTransitionStyles from "@transition/styles";

import { devWarn } from "@utils/devDiagnostics";

import StoreContext, { type FlemoStores } from "@stores/StoreContext";

import RouterDepthContext from "./RouterDepthContext";
import RouterIdContext from "./RouterIdContext";
import RouterScopeContext, { type RouterScopeNode } from "./RouterScopeContext";
import { findDuplicateNamedAncestor } from "./RouterTarget";
import Slot from "./Slot";

import type { RouteProps } from "@Route";
import type { Path } from "path-to-regexp";

// Find a <Slot> in the layout tree and return its <Route> children — the route
// declarations to seed and match against. The Slot may sit anywhere in the
// static JSX the Router receives (nested in layout divs is fine), so walk
// recursively. null when there's no Slot: the Router then treats its own
// children as the routes (the bare, full-viewport form).
function findSlotRoutes(node: ReactNode): ReactElement<RouteProps>[] | null {
  let routes: ReactElement<RouteProps>[] | null = null;
  Children.forEach(node, (child) => {
    if (routes || !isValidElement(child)) return;
    if (child.type === Slot) {
      routes = Children.toArray((child.props as PropsWithChildren).children).filter(
        isValidElement
      ) as ReactElement<RouteProps>[];
      return;
    }
    const nested = (child.props as PropsWithChildren).children;
    if (nested) {
      const found = findSlotRoutes(nested);
      if (found) routes = found;
    }
  });
  return routes;
}

interface RouterProps {
  // A stable identity for cross-Router navigation: `useNavigate({ router:
  // "app" })` / `push(path, params, { router: "app" })` run against the
  // <Router name="app"> that encloses the call. Purely a lookup key — it is
  // NOT the internal `routerKey` that namespaces `history.state` (that one is
  // derived, see below), so renaming a Router never orphans its frames.
  // Consumer-provided, therefore stable across SSR and hydration by
  // construction. Names must be unique within one chain of nested Routers;
  // a duplicate is reported in development.
  name?: string;
  // Upgrade the "this Router does not declare that route" development WARNING
  // to a thrown error for navigations that leave the target implicit. Explicit
  // `router:` targets always throw in development — this opt-in extends the
  // same strictness to plain `push`/`replace` calls, which stay warn-only by
  // default so existing apps keep their behavior.
  strictRoutes?: boolean;
  initPath?: string;
  defaultTransitionName?: TransitionName;
  transitions?: Transition[];
  decorators?: Decorator[];
  partTransitions?: PartTransition[];
  // Which history backend this Router drives. "browser" (default) reads/writes
  // `window.history` so the URL and browser back/forward work inside it, even
  // when the Router is nested. "memory" keeps an isolated in-memory stack that
  // never touches `window.history`, the URL, or browser back. History mode is
  // independent of nesting: nesting only controls the contained box rendering.
  history?: "browser" | "memory";
  // Override the browser history backend. Receives this Router's key (for state
  // namespacing) and returns a HistoryDriver — e.g. a locale-aware wrapper that
  // maps a URL prefix while the Router stays in unprefixed path space, so it
  // never reads or writes `window.location` directly. Ignored for
  // history="memory". Defaults to the keyed browser driver.
  createDriver?: (routerKey?: string) => HistoryDriver;
  // Applied to the region box of a NESTED <Router> only (a root <Router> renders
  // no wrapper — its screens are fixed to the viewport). Size the region here.
  className?: string;
  style?: CSSProperties;
}

// useLayoutEffect warns when rendered on the server; the server never needs the
// flip anyway (scopes start alive), so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const EMPTY_TRANSITIONS: Transition[] = [];
const EMPTY_DECORATORS: Decorator[] = [];
const EMPTY_PART_TRANSITIONS: PartTransition[] = [];

// Stable context value so a nested Router's screens don't re-render on identity churn.
const CONTAINED_VIEWPORT = { contained: true };

// Interaction-warm cadence: how often the hold is renewed while interaction
// continues, and how long it survives past the last interaction — enough to
// bridge move -> tap -> the flight's own warm-up taking over, short enough
// that a walked-away user costs nothing lasting.
const INTERACTION_WARM_RENEW_MS = 500;
const INTERACTION_WARM_TAIL_MS = 3000;

function Router({
  children,
  name,
  strictRoutes = false,
  initPath = "/",
  defaultTransitionName = "cupertino",
  transitions = EMPTY_TRANSITIONS,
  decorators = EMPTY_DECORATORS,
  partTransitions = EMPTY_PART_TRANSITIONS,
  history = "browser",
  createDriver,
  className,
  style
}: PropsWithChildren<RouterProps>) {
  // A <Router> rendered inside another is a nested transition region: it contains
  // its screens to its box. Detected via depth, NOT the store context, since a
  // parent Router already provides a (seeded) StoreContext to its descendants.
  // Nesting controls ONLY the contained rendering; the history backend is chosen
  // by the `history` prop, independent of depth.
  const depth = useContext(RouterDepthContext);
  // This Router's flight-boundary identity (see RouterIdContext). useId gives
  // page-load uniqueness, but its value encodes the component's position from
  // the HYDRATION ROOT — so a consumer whose server render root differs from
  // its client hydrate root (e.g. server renders <Html><App/></Html> while the
  // client hydrateRoot's just <App/> at #root) produces a DIFFERENT useId on
  // each side, and this id is the one flemo attribute that reaches the DOM
  // (data-flemo-router), so it surfaces as a hydration mismatch. The engine
  // only ever reads this attribute CLIENT-side (it scopes live flights; SSR
  // never runs it), so the marker is withheld until after hydration: the
  // server and the first client render both emit nothing (a match), and an
  // effect exposes the id once mounted. Robust to any consumer's root config.
  const routerId = useId();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const exposedRouterId = hydrated ? routerId : null;
  const isNested = depth > 0;

  // The history backend. "browser" (the default, even when nested) participates
  // in `window.history`; "memory" runs an isolated in-memory stack.
  const useMemory = history === "memory";

  // A stable per-Router id. The browser driver namespaces its `history.state`
  // under this key so multiple browser Routers on one page don't clobber each
  // other's frame or mis-handle each other's popstate.
  //
  // A NESTED Router derives the key from its OWNING chain — the parent Router's
  // key plus its enclosing screen's history-entry id — instead of useId: both
  // halves are restored verbatim across traversals (the root's useId is
  // hydration-stable; entry ids ride the browser frames), so a remounted Router
  // reads the frames its previous incarnation wrote. useId's client counter
  // changes on every remount, which orphaned those frames — after a rapid
  // back-across-the-boundary-then-forward, the reborn Router classified every
  // traversal as foreign and the URL walked away from the screen. The parent
  // key half matters because entry ids are only unique WITHIN one Router —
  // every stack's first entry is "root", so two nesting LEVELS both sitting on
  // their root entries would otherwise share one key, and the scope-persistence
  // registry would hand the inner Router the outer Router's stores. The root
  // Router keeps bare useId (a root remount is an app teardown, not a
  // traversal).
  const reactId = useId();
  const parentScreen = useContext(ScreenContext);
  // The parent Router's bundle (also read below for the hosted-adoption path).
  const parentStores = useContext(StoreContext);
  const routerKey =
    isNested && parentScreen.id
      ? `_F_${parentStores?.routerKey ?? ""}${parentScreen.id}_`
      : reactId;

  // When the layout marks a content region with <Slot>, the routes live inside
  // it and the rest of `children` is persistent chrome (rendered as-is, with the
  // Slot rendering the screen stack at its position). Without a Slot, `children`
  // are the routes and the Router renders the full-viewport stack itself.
  const slotRoutes = findSlotRoutes(children);
  const hasSlot = slotRoutes !== null;

  // The route patterns this Router declares. Read in RENDER (not just in the
  // store initializer, as before) because the scope node publishes them for
  // cross-Router target resolution: "does the Router you named actually own
  // this path?". Non-<Route> children are skipped — without a <Slot> they are
  // indistinguishable from routes, and a pathless child would otherwise reach
  // path-to-regexp as `undefined`.
  const routeChildren =
    slotRoutes ?? (Children.toArray(children).filter(isValidElement) as ReactElement<RouteProps>[]);
  const routePaths: Path[] = routeChildren.flatMap((child) =>
    child.props?.path ? ([child.props.path].flat() as Path[]) : []
  );

  // A <RouterScopeProvider> above the Router hosts the bundle so siblings outside the Router (an
  // inspector/devtools panel) can read it. Adopt it when present; otherwise own the bundle here.
  // Ignored when nested: a nested Router always owns its own (local) bundle.
  const hostedStores = isNested ? null : parentStores;
  const isHosted = hostedStores !== null;

  // One driver per Router, created eagerly for every browser Router so the seed
  // pathname is read THROUGH the driver (never window.location directly). A
  // custom factory (e.g. a locale-aware wrapper) then owns the whole URL surface.
  // Memory builds its driver in the store init (it needs the seeded root frame).
  const createBrowserDriver = createDriver ?? createBrowserHistoryDriver;
  const [browserDriver] = useState<HistoryDriver | null>(() =>
    useMemory ? null : createBrowserDriver(isHosted ? undefined : routerKey)
  );

  // Only a root browser Router reads the live browser location to seed its first
  // frame. A nested Router (browser or memory) and a memory root seed from
  // initPath: a nested browser rides the host's current entry rather than
  // reflecting the host's URL.
  const readsWindowLocation = !isNested && !useMemory && !isServer();
  // initPath may carry a query (a deep-linked step, e.g. /playground/1?code=x).
  // Split it so the route matches on the clean pathname while its params still
  // resolve from the search. A no-query initPath is unchanged.
  const location =
    readsWindowLocation && browserDriver ? browserDriver.readPathname() : initPath || "/";
  const queryIndex = location.indexOf("?");
  const pathname = (queryIndex >= 0 ? location.slice(0, queryIndex) : location) || "/";
  const search = readsWindowLocation
    ? window.location.search
    : queryIndex >= 0
      ? location.slice(queryIndex)
      : "";

  // Create (or adopt) the request-scoped store bundle once per mount. The
  // seeding / driver / guard logic is @flemo/core's createRouterScope (because
  // the seed is the store's *initial* state, zustand hands it to React as the
  // SSR snapshot); this binding only resolves the route declarations from its
  // JSX children.
  const [stores] = useState<FlemoStores>(() =>
    createRouterScope({
      routePaths,
      pathname,
      search,
      defaultTransitionName,
      memory: useMemory,
      browserDriver,
      hostedScope: hostedStores,
      routerKey: isHosted ? undefined : routerKey,
      zoneEntryId: isNested && !isHosted ? parentScreen.id || undefined : undefined,
      // A NESTED browser Router persists its scope across destroy/re-create,
      // keyed by its (entry-id-derived, re-entry-stable) router key: leaving
      // its zone with browser Back destroys the Router, but the zone's history
      // entries survive in the browser — traversing back into them must resume
      // the same stack (animated pops), not reseed a blank one (silent adopts).
      persistKey: isNested && !useMemory && !isHosted ? routerKey : undefined
    })
  );

  // Keep the seeded default in sync if the prop changes across renders.
  stores.transition.setState({ defaultTransitionName });

  // This Router's node in the scope CHAIN — the structure `useNavigate` walks
  // to resolve `router: "parent" | "root" | "<name>" | "nearest-owner"`.
  // StoreContext only ever exposes the nearest bundle, so without the chain a
  // nested Router's screens have no way to reach the Router above them.
  //
  // The node is created once and MUTATED in place afterwards: its identity is
  // the context value, and a stable one means adding this provider costs the
  // tree exactly zero extra re-renders (route lists and names change without
  // notifying anyone — every consumer reads the node at navigation time, not
  // at render time). The same reason `stores.transition.setState` above runs
  // in render: this is Router-owned state, not React state.
  const parentScope = useContext(RouterScopeContext);
  const [scope] = useState<RouterScopeNode>(() => ({
    name,
    stores,
    routePaths,
    strictRoutes,
    parent: parentScope,
    depth
  }));
  scope.name = name;
  scope.stores = stores;
  scope.routePaths = routePaths;
  scope.strictRoutes = strictRoutes;
  scope.parent = parentScope;

  // Two Routers sharing a name in ONE chain make `router: "<name>"` ambiguous
  // (resolution silently takes the nearer one). Report it once per mount, in
  // an effect so it never fires during a discarded render.
  useEffect(() => {
    const duplicate = findDuplicateNamedAncestor(scope);
    if (!duplicate) return;
    devWarn(
      `duplicate <Router name="${scope.name}">: an enclosing <Router> already uses that name, ` +
        "so `router` targets resolve to the nearer one. Give each nested Router a unique name."
    );
  }, [scope, name]);

  // Router liveness for queued navigation tasks: a push/pop task can sit in
  // the shared queue behind an in-flight transition and run after this Router
  // unmounted — it must abort rather than move the browser history for screens
  // that no longer exist. Set on every mount (strict-mode remounts and hosted
  // re-adoption included), cleared on unmount.
  // Liveness must flip SYNCHRONOUSLY at commit, before paint: the history sync
  // reads it to decide "animate (visible) vs apply instantly (offscreen)", and
  // a passive effect flushes AFTER the reveal paints — a traversal task running
  // in that window would see a VISIBLE zone as dead and swap its screen with no
  // transition (a user-visible skip, frequent under dev/strict effect cycling).
  // A layout effect closes the window: <Activity> mounts layout effects before
  // the reveal paints, so a visible zone always reads alive. (Server render
  // never runs layout effects; `alive` starts true from createRouterScope.)
  useIsomorphicLayoutEffect(() => {
    stores.life.alive = true;
    return () => {
      stores.life.alive = false;
    };
  }, [stores]);

  // Registers user-provided transitions/decorators with the global maps and
  // injects the compiled CSS keyframes into the document head. Runs in
  // useInsertionEffect so styles are committed before any screen paints.
  useTransitionStyles(transitions, decorators, partTransitions);

  // Off-main decode-to-scale for oversized images (see @flemo/core
  // imageDecodeOffloader): WebKit decodes full-resolution originals
  // synchronously on the main thread, which was measured eating a tab
  // transition whole — a 190ms fade presented 5 of its 12 frames and ran for
  // 384ms. Document-wide and refcounted, so nested Routers share one observer.
  //
  // AUTO on legacy Android Blink only; OFF everywhere else. It rewrites
  // oversized consumer <img> sources to re-encoded, downscaled blobs, so it
  // must never run where the paint is already cheap — the old blanket opt-in
  // existed only because the library "could not tell a GPU-starved phone from
  // a flagship at load." `isLegacyAndroidBlink()` closes exactly that gap: a
  // touch Chromium that ships NO UA-CH brands is confidently pre-2021 hardware
  // (device-confirmed: Galaxy Note 9 Samsung Internet reports no brands, and
  // its 37MP-original members list stalled the opening on every re-entry).
  // A flagship ships UA-CH brands → excluded; iPhone carries no Android token →
  // excluded; and even on a matched device only genuinely OVERSIZED sources
  // (OVERSIZE_AREA_RATIO) are ever touched — a well-sized image is left as
  // authored. `flemo:imgoffload` (readImageOffloadOverride, from @flemo/core's
  // diagnostic-flag registry) overrides both ways: `on` forces it (any
  // engine, for a consumer whose own measurement demands it), `off` opts a
  // legacy device back out.
  useEffect(() => {
    const flag = readImageOffloadOverride();
    if (flag === "off") return undefined;
    const enabled = flag === "on" || isLegacyAndroidBlink();
    return enabled ? ensureImageDecodeOffloader() : undefined;
  }, []);

  // One-shot GPU pipeline prewarm (see @flemo/core gpuPipelinePrewarm):
  // Chrome's Graphite backend compiles the flight's GPU pipelines on their
  // first draw — on a cold cache (fresh profile, Chrome update, GPU-process
  // restart) that's ~100ms of GPU-thread stall landing INSIDE the session's
  // first flight, worst on the deceleration frames. Imperceptible probes at
  // boot idle compile them ahead of any motion.
  useEffect(() => ensureGpuPipelinePrewarm(), []);

  // Pre-warm the compositor while the user INTERACTS. The per-flight warm-up
  // starts WITH the flight, so the first navigation after an idle period
  // still pays the pipeline's wake-up (frame clock, GPU power state) inside
  // its opening frames — observed as a first-journey judder that disappears
  // while a Performance recording (a continuous frame producer) runs, and
  // measured to survive a press-scoped warm: the wake costs more than the
  // 50-300ms a press precedes its navigation by. So the warm rides ANY
  // interaction — a pointer moving toward a tap precedes it by seconds —
  // renewed at most twice a second, released a short tail after the
  // interaction stops. This reproduces exactly what the recording does, but
  // only while the user is actually about to do something.
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let release: (() => void) | null = null;
    let tail: ReturnType<typeof setTimeout> | null = null;
    let lastRenewal = 0;
    const renew = () => {
      const now = Date.now();
      // Renew the hold (overlapping holds are refcounted; each carries the
      // module's ~3s backstop, so a long interaction must keep re-taking it)
      // at a throttled cadence — pointermove fires per frame.
      if (now - lastRenewal < INTERACTION_WARM_RENEW_MS) return;
      lastRenewal = now;
      if (tail) clearTimeout(tail);
      const previous = release;
      release = holdCompositorWarm();
      previous?.();
      tail = setTimeout(() => {
        tail = null;
        release?.();
        release = null;
      }, INTERACTION_WARM_TAIL_MS);
    };
    const events = ["pointerdown", "pointermove", "wheel", "touchstart", "keydown"] as const;
    for (const type of events) document.addEventListener(type, renew, { passive: true });
    return () => {
      for (const type of events) document.removeEventListener(type, renew);
      if (tail) clearTimeout(tail);
      release?.();
    };
  }, []);

  useEffect(() => {
    // Stamp this Router's identity onto the entry it mounted on: seed its keyed
    // frame and (nested) reflect the seed URL — fenced to its own zone so a
    // late-flushing effect never touches a foreign entry. All of that decision
    // logic is @flemo/core's seedRouterEntry; this effect only picks WHEN. A
    // memory Router never touches the browser history.
    if (useMemory || !browserDriver) return;
    seedRouterEntry({
      driver: browserDriver,
      routerKey: isHosted ? null : routerKey,
      nested: isNested && !isHosted,
      seedPathname: pathname,
      defaultTransitionName,
      rootParams: stores.history.getState().histories[0]?.params ?? {}
    });
  }, [
    useMemory,
    isHosted,
    isNested,
    routerKey,
    pathname,
    defaultTransitionName,
    stores.history,
    browserDriver
  ]);

  // With a <Slot>, render the layout as-is (the Slot renders the contained stack
  // at its position); without one, render the stack directly. `children` already
  // carries its own positioning in the Slot case, so the bare-children form is
  // the same for root (viewport-fixed) and nested (the region box wraps it).
  const stack = hasSlot ? children : <Renderer>{children}</Renderer>;

  // A browser Router (root OR nested) runs the popstate-to-navigation bridge over
  // its own keyed driver + guard. A memory Router runs none (its driver's
  // traversals are awaited inline by the controller).
  const content = (
    <RouterIdContext.Provider value={exposedRouterId}>
      <RouterDepthContext.Provider value={depth + 1}>
        <RouterScopeContext.Provider value={scope}>
          <StoreContext.Provider value={stores}>
            {!useMemory && <HistoryListener />}
            {isNested ? (
              <ScreenViewportContext.Provider value={CONTAINED_VIEWPORT}>
                {stack}
              </ScreenViewportContext.Provider>
            ) : (
              stack
            )}
          </StoreContext.Provider>
        </RouterScopeContext.Provider>
      </RouterDepthContext.Provider>
    </RouterIdContext.Provider>
  );

  // A nested region contains its screens to a positioned box (the consumer sizes
  // it via className/style) and clips the slide overflow. Everything outside this
  // <Router> in the layout persists across its navigations. A root Router renders
  // no wrapper: its screens are fixed to the viewport.
  if (isNested) {
    return (
      <div className={className} style={{ position: "relative", overflow: "hidden", ...style }}>
        {content}
      </div>
    );
  }

  return content;
}

export default Router;

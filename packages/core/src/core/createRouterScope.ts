import type { HistoryDriver } from "@history/historyDriver";
import createMemoryHistoryDriver from "@history/memoryHistoryDriver";
import seedInitialHistory from "@history/seedInitialHistory";

import createHistoryStore, { type HistoryStoreApi } from "@history/store";

import { createSelfPopGuard, type SelfPopGuard } from "@navigate/selfPopGuard";
import createNavigateStore, { type NavigateStoreApi } from "@navigate/store";

import createTransitionStore, { type TransitionStoreApi } from "@transition/store";

import type { TransitionName } from "@transition/typing";

import isServer from "@utils/isServer";

import createScreenStore, { type ScreenStoreApi } from "@screen/store";

import type { Path } from "path-to-regexp";

// The request-scoped store bundle for one Router scope. A binding creates one
// per Router mount and provides it to every consumer (renderer, navigation
// hooks, screen runtime) so they read the same per-request instances — no
// module-level singletons shared across SSR requests.
export interface FlemoStores {
  history: HistoryStoreApi;
  navigate: NavigateStoreApi;
  transition: TransitionStoreApi;
  screen: ScreenStoreApi;
  // The history backend for this Router scope: the browser History API for a
  // root <Router>, an in-memory stack for a memory one. Shared by the
  // navigation controller and the history sync so both drive the same history.
  driver: HistoryDriver;
  // Self-pop guard for this scope. A browser <Router> creates its own guard
  // instance: `markSelfInduced` (injected into the navigation controller) marks
  // a flemo-induced traversal, and `consume` (injected into the history sync)
  // skips it. A memory <Router> uses a no-op mark and a never-true consume.
  markSelfInduced: () => void;
  consume: () => boolean;
  // True for a scope held in the persistence registry (a nested browser
  // Router's). Its binding must keep the HISTORY SYNC alive across unmounts
  // too: a frozen/destroyed zone still hears traversals and applies them
  // instantly, so it is already on the right entry whenever it is revealed.
  persistent?: boolean;
  // The owning Router's liveness. A navigation task can sit queued behind an
  // in-flight transition and outlive the Router that created it (its screen
  // popped away in the meantime); running it would then move the BROWSER
  // history while only a dead store hears about it, walking the URL away from
  // every live screen. The binding flips this off on unmount; queued
  // navigation and traversal tasks abort on arrival when their Router is gone.
  life: { alive: boolean };
}

// A no-op self-pop guard for a memory Router: it has no browser history sync
// to coordinate with, so it never marks and never reports a self-induced pop.
const NOOP_GUARD: SelfPopGuard = { mark: () => {}, consume: () => false };

// Scopes of DESTROYED nested Routers, keyed by their stable router key. When
// its enclosing screen is popped away (leaving a zone with browser Back), a
// nested Router unmounts and its in-memory stack would die with it — but the
// BROWSER still holds that zone's history entries, and the user can traverse
// back into them at any time. A fresh reseed knows only one entry, so every
// further Back inside the zone would degrade to a non-animated in-place adopt:
// the "after bouncing between zones, back/forward stops transitioning" bug.
// Keeping the scope here lets a re-created Router resume the stack its previous
// incarnation held, so traversals into old sub-entries stay ANIMATED pops.
// Session-scoped on purpose: the entries it serves live exactly as long as the
// tab's history does. Client-only (module state never runs on the server).
const persistedScopes = new Map<string, FlemoStores>();

export interface CreateRouterScopeInput {
  // The declared route patterns; the seed matches `pathname` against them to
  // derive the root frame's params.
  routePaths: Path[];
  pathname: string;
  search: string;
  defaultTransitionName: TransitionName;
  // "memory" keeps an isolated in-memory stack that never touches
  // window.history; otherwise the provided browser driver backs the scope.
  memory: boolean;
  // The browser history backend, created by the binding (it owns the driver
  // factory choice and key namespacing). Ignored for a memory scope.
  browserDriver: HistoryDriver | null;
  // A pre-existing bundle hosted ABOVE the Router (a devtools scope provider).
  // When present it is adopted: its empty history is seeded once and the
  // bundle is returned as-is.
  hostedScope: FlemoStores | null;
  // Persist this scope across destroy/re-create under this key (see the
  // registry above). Set by the binding for a NESTED browser Router, using its
  // stable router key — the enclosing screen's entry id, which a zone re-entry
  // restores verbatim, so the reborn Router resolves the same key. Absent for
  // root (an app teardown is final), memory (isolated), and hosted scopes.
  persistKey?: string;
}

// Creates (or adopts) the store bundle for a Router scope, seeding history
// with the root frame derived from the pathname. Because the seed is the
// store's *initial* state, zustand hands it to the binding as the SSR
// snapshot, so the screen renders on the server and each request keeps its
// own stack. Framework-neutral: the binding resolves children/routes, driver
// creation, and context distribution around it.
export default function createRouterScope(input: CreateRouterScopeInput): FlemoStores {
  const { routePaths, pathname, search, defaultTransitionName, memory, browserDriver } = input;
  const persistKey = !isServer() ? input.persistKey : undefined;

  // A re-created Router resumes its previous incarnation's scope instead of
  // reseeding (see the registry above). The scope may have died mid-transition,
  // so bring it to rest; if the browser re-entered the zone on a different
  // entry than the resumed top, the sync's convergence pass walks the content
  // there with full transitions right after mount.
  if (persistKey) {
    const persisted = persistedScopes.get(persistKey);
    if (persisted) {
      persisted.life.alive = true;
      persisted.navigate.getState().setStatus("IDLE");
      persisted.navigate.getState().setTransitionTaskId(null);
      const history = persisted.history.getState();
      history.setPendingIndex(history.index);
      return persisted;
    }
  }

  const seededHistory = seedInitialHistory(routePaths, pathname, search, defaultTransitionName);
  // A Router remounting onto an entry a previous incarnation wrote adopts that
  // entry's IDENTITY (id, params, browser-space stamp): the seed then IS the
  // present entry, so a traversal back onto it matches by id instead of
  // colliding with the generic "root" (which a reseed of a different entry
  // would also carry — a same-id false positive that swallowed traversals).
  // A virgin entry keeps the generic seed and starts its stamp chain at 0.
  const presentFrame =
    browserDriver && !isServer()
      ? (browserDriver.readState() as {
          id?: string;
          index?: number;
          params?: object;
        } | null)
      : null;
  const rootHistory = presentFrame?.id
    ? {
        ...seededHistory,
        id: presentFrame.id,
        params: presentFrame.params ?? seededHistory.params,
        frameIndex: presentFrame.index ?? 0
      }
    : { ...seededHistory, frameIndex: 0 };

  // Hosted bundle: seed its history once (it starts empty at index -1). Seeding
  // here rather than at creation means a hosted setup doesn't get the SSR
  // snapshot, but the provider is for client-side devtools layouts, so that's
  // fine.
  if (input.hostedScope) {
    // A (re)adopting Router brings the hosted scope back to life.
    input.hostedScope.life.alive = true;
    if (input.hostedScope.history.getState().index === -1) {
      input.hostedScope.history.setState({ index: 0, histories: [rootHistory] });
    }
    return input.hostedScope;
  }

  // A memory Router drives an in-memory history (seeded to match its root
  // frame) and never marks a guard. A browser Router (root OR nested) drives
  // the keyed browser History API and gets its OWN self-pop guard, so a
  // sibling Router's traversal isn't mis-attributed to it.
  const driver = memory
    ? createMemoryHistoryDriver({
        state: {
          id: rootHistory.id,
          index: 0,
          status: "IDLE",
          params: rootHistory.params,
          transitionName: rootHistory.transitionName,
          layoutId: rootHistory.layoutId
        },
        url: rootHistory.pathname
      })
    : browserDriver!;

  const guard = memory ? NOOP_GUARD : createSelfPopGuard();

  const scope: FlemoStores = {
    history: createHistoryStore([rootHistory], 0),
    navigate: createNavigateStore(),
    transition: createTransitionStore(defaultTransitionName),
    screen: createScreenStore(),
    driver,
    markSelfInduced: guard.mark,
    consume: guard.consume,
    persistent: !!persistKey,
    life: { alive: true }
  };

  // Keep a nested browser scope for the session so a zone re-entry resumes it
  // (see the registry above). The live scope sits in the map too, which also
  // makes a same-key remount (strict mode, host re-render) resolve to the same
  // instance instead of clobbering a live stack.
  if (persistKey) {
    persistedScopes.set(persistKey, scope);
  }

  return scope;
}

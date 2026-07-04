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
}

// Creates (or adopts) the store bundle for a Router scope, seeding history
// with the root frame derived from the pathname. Because the seed is the
// store's *initial* state, zustand hands it to the binding as the SSR
// snapshot, so the screen renders on the server and each request keeps its
// own stack. Framework-neutral: the binding resolves children/routes, driver
// creation, and context distribution around it.
export default function createRouterScope(input: CreateRouterScopeInput): FlemoStores {
  const { routePaths, pathname, search, defaultTransitionName, memory, browserDriver } = input;

  const seededHistory = seedInitialHistory(routePaths, pathname, search, defaultTransitionName);
  // Stamp the seed with the CURRENT entry's browser-space frame index when one
  // exists (a Router remounting onto an entry a previous incarnation wrote, or
  // one the browser drifted to). A fresh entry starts its chain at 0.
  const seedStamp =
    browserDriver && !isServer()
      ? ((browserDriver.readState() as { index?: number } | null)?.index ?? 0)
      : 0;
  const rootHistory = { ...seededHistory, frameIndex: seedStamp };

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

  return {
    history: createHistoryStore([rootHistory], 0),
    navigate: createNavigateStore(),
    transition: createTransitionStore(defaultTransitionName),
    screen: createScreenStore(),
    driver,
    markSelfInduced: guard.mark,
    consume: guard.consume,
    life: { alive: true }
  };
}

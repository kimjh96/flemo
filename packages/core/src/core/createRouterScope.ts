import { readRecordedFrame } from "@history/createHistorySync";
import type { HistoryDriver } from "@history/historyDriver";
import createMemoryHistoryDriver from "@history/memoryHistoryDriver";
import seedInitialHistory from "@history/seedInitialHistory";

import createHistoryStore, { type HistoryStoreApi } from "@history/store";

import { createSelfPopGuard } from "@navigate/selfPopGuard";
import createNavigateStore, { type NavigateStoreApi } from "@navigate/store";

import createTransitionStore, { type TransitionStoreApi } from "@transition/store";

import type { TransitionName } from "@transition/typing";

import isServer from "@utils/isServer";
import matchesPathname from "@utils/matchesPathname";

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
  // Whether that backend is the in-memory one. Both backends mount the history
  // sync, so `driver.back()` is the commit either way; this only tells the sync
  // to keep this scope out of the parts of itself that read the BROWSER's live
  // entry — the shared traversal recorder and the zone replay built on it.
  memory: boolean;
  // Self-pop guard for this scope. Each <Router> creates its OWN instance:
  // `markSelfInduced` (injected into the navigation controller) marks a
  // flemo-induced traversal, and `consume` (injected into the history sync)
  // skips it, so a sibling Router's `go(-n)` is never mis-attributed.
  markSelfInduced: () => void;
  consume: () => boolean;
  // The key this Router's frames live under in `history.state`; the sync uses
  // it to replay recorded traversals the zone missed while it had no Router.
  routerKey?: string;
  // The enclosing screen's entry id (a nested Router's zone identity); gates
  // the sync's missed-traversal replay to the zone the browser is still in.
  zoneEntryId?: string;
  // Whether a pathname belongs to this Router's declared routes; the sync
  // ignores traversals outside it (a copied frame under our key can ride on a
  // foreign zone's entry — materializing it would create an entry no Route
  // matches, which the renderer cannot mount).
  ownsPathname?: (pathname: string) => boolean;
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
  // The key this Router's frames live under in `history.state` (the binding's
  // Defer the entry-identity adoption below to the binding.
  //
  // THE FIRST CLIENT RENDER HAS TO BE THE SERVER'S RENDER. The adoption reads
  // `window.history.state`, which the server cannot see, and this function runs
  // inside the store's initializer — which for a hydrating tree is the one
  // render that must agree with the server. `history.state` survives a reload,
  // so any refresh on a page that had pushed left the client seeding a
  // generated id where the server had written "root", and React does not patch
  // a mismatched attribute: the DOM kept "root" while the store believed the
  // other, the engine and the document disagreeing about which screen this is
  // for the life of the page.
  //
  // A binding that hydrates therefore seeds without adopting and calls
  // `adoptEntryIdentity` once hydration is over. Nothing else changes: a scope
  // created later on the client still adopts here, in the same render.
  deferEntryAdoption?: boolean;
  // router key; the same string a nested Router uses as persistKey). Lets the
  // seed adopt the identity RECORDED for its entry and the sync replay the
  // zone's missed traversals.
  routerKey?: string;
  // The enclosing screen's entry id, for a NESTED Router (see FlemoStores).
  zoneEntryId?: string;
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
  // A Router created on an entry a previous incarnation wrote adopts that
  // entry's IDENTITY (id, params, browser-space stamp): the seed then IS the
  // entry, so a traversal back onto it matches by id instead of colliding with
  // the generic "root" (a same-id false positive that swallowed traversals).
  //
  // The identity comes from the traversal RECORDER first — the frame recorded
  // for the entry this Router is SEEDED on — and only falls back to the live
  // `history.state` when nothing was recorded (a fresh boot, a deep link). The
  // distinction matters mid-walk: a rapid forward run crosses into a zone and
  // keeps going before the zone's Router finishes mounting, so the LIVE entry
  // is already several steps ahead — adopting it would seed the zone at that
  // ahead position and every event in between would classify as "already
  // passed", skipping their screens. The recorded frame pins the seed to the
  // crossing entry, and the sync then replays the missed events in order.
  const recordedFrame =
    input.routerKey && !isServer() && !input.deferEntryAdoption
      ? (readRecordedFrame(input.routerKey, pathname) as {
          id?: string;
          index?: number;
          params?: object;
        } | null)
      : null;
  const presentFrame =
    recordedFrame ??
    (browserDriver && !isServer() && !input.deferEntryAdoption
      ? (browserDriver.readState() as {
          id?: string;
          index?: number;
          params?: object;
        } | null)
      : null);
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
          transitionName: rootHistory.transitionName
        },
        url: rootHistory.pathname
      })
    : browserDriver!;

  // EVERY scope gets a real guard, memory included. Its sync is mounted too —
  // that is what makes `driver.back()` the commit on both backends, which the
  // swipe controller depends on — so a flemo-induced traversal has to be
  // balanced here exactly as a browser Router's is, or the navigation queue's
  // own `back()` would come back around and pop a second time.
  const guard = createSelfPopGuard();

  const scope: FlemoStores = {
    history: createHistoryStore([rootHistory], 0),
    navigate: createNavigateStore(),
    transition: createTransitionStore(defaultTransitionName),
    screen: createScreenStore(),
    driver,
    memory,
    markSelfInduced: guard.mark,
    consume: guard.consume,
    routerKey: input.routerKey,
    zoneEntryId: input.zoneEntryId,
    ownsPathname: (candidate) => matchesPathname(routePaths, candidate),
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

/**
 * Adopt the identity of the browser entry this scope was seeded on, after the
 * fact — the deferred half of `deferEntryAdoption`.
 *
 * A binding that hydrates calls this once hydration is over, and the store's
 * root frame stops being the generic "root" and becomes the entry it is
 * actually sitting on. That matters for exactly the reason the construction
 * path adopts at all: a traversal back onto this entry has to match it by id
 * rather than collide with every other scope's "root".
 *
 * Every guard below is a refusal to overwrite something real:
 *
 *   - a scope that already navigated has a stack this is not the seed of, and
 *     rewriting its first frame's id would rename an entry the user has since
 *     left,
 *   - a seed that is no longer "root" was adopted already (a re-run, a strict
 *     mode double effect),
 *   - a memory scope has no browser entry to adopt, and
 *   - an entry with no frame of its own has no identity to take.
 */
export function adoptEntryIdentity(scope: FlemoStores): void {
  if (isServer() || scope.memory) return;

  const { histories, index } = scope.history.getState();
  if (index !== 0 || histories.length !== 1) return;
  const seed = histories[0];
  if (!seed || seed.id !== "root") return;

  const recorded = scope.routerKey
    ? (readRecordedFrame(scope.routerKey, seed.pathname) as {
        id?: string;
        index?: number;
        params?: object;
      } | null)
    : null;
  const present =
    recorded ??
    (scope.driver.readState() as { id?: string; index?: number; params?: object } | null);
  if (!present?.id || present.id === seed.id) return;

  scope.history.setState({
    histories: [
      {
        ...seed,
        id: present.id,
        params: present.params ?? seed.params,
        frameIndex: present.index ?? 0
      }
    ]
  });
}

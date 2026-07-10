import TaskManager, { TRANSITION_GATE_BACKSTOP_MS } from "@core/TaskManger";

import createBrowserHistoryDriver, {
  type HistoryDriver,
  type HistoryNavEvent
} from "@history/historyDriver";
import type { HistoryStoreApi } from "@history/store";

import { consumeSelfInducedPop } from "@navigate/selfPopGuard";
import type { NavigateStatus, NavigateStoreApi } from "@navigate/store";

import type { TransitionName } from "@transition/typing";

export interface HistorySyncDeps {
  // The request-scoped stores (framework-neutral zustand vanilla stores).
  stores: {
    history: HistoryStoreApi;
    navigate: NavigateStoreApi;
  };
  // The history backend. Defaults to the real browser History API; a nested
  // <Router> injects an in-memory driver so its navigation stays local.
  driver?: HistoryDriver;
  // Consumes a flemo-induced traversal so the sync ignores its own popstate.
  // Defaults to the global guard a lone root <Router> shares with its controller;
  // a keyed browser <Router> injects its OWN guard's `consume` so a sibling
  // Router's `go(-n)` isn't mis-attributed to this one.
  consume?: () => boolean;
  // The key this Router's frames live under in `history.state`. When present,
  // a freshly-attached sync replays the recorded traversals its zone missed
  // while no sync existed for it (see the traversal recorder below).
  routerKey?: string;
  // The enclosing screen's history-entry id (a NESTED Router's zone identity).
  // The missed-traversal replay only runs when the browser's LIVE entry still
  // belongs to this zone — replaying a zone the walk has already left would
  // enqueue its transitions behind the shell's later crossings, playing them
  // out of order on a frozen screen.
  zoneEntryId?: string;
  // Whether a pathname belongs to this Router's route space. Frames are COPIED
  // across entries when another Router pushes (mergeKeyedState preserves every
  // key), so an event for a FOREIGN entry can still carry a frame under our key
  // — classifying it could materialize an entry whose pathname no Route of ours
  // matches, which the renderer cannot mount. Events outside the route space
  // are not ours to handle at all.
  ownsPathname?: (pathname: string) => boolean;
}

// The flemo frame a back/forward event carries (stored by a prior push/replace).
// A foreign (non-flemo) entry won't have these, so the classification below
// rejects it.
interface PopStateFrame {
  id: string;
  index: number;
  status: NavigateStatus;
  params: object;
  transitionName: TransitionName;
  layoutId: string | number | null;
}

// Bridge the Back/Forward traversals the driver reports into flemo's navigation
// queue: classify the event against the current stack (pop / push / replace),
// park a manual-gated task, mutate the stores, and resolve on completion.
// flemo-induced traversals are filtered via the self-pop guard. Framework-
// neutral: subscribes through the injected driver and returns its disposer; a
// binding calls it from its own effect.
export default function createHistorySync(deps: HistorySyncDeps): () => void {
  const { stores, driver = createBrowserHistoryDriver(), consume = consumeSelfInducedPop } = deps;

  // Set when the binding disposes this sync (its Router unmounted). Traversal
  // tasks the sync already queued can still be sitting in the SHARED task
  // queue behind an in-flight transition; when one of them finally runs
  // against the dead Router it would start a transition whose screens no
  // longer exist, so its manual gate (animationend) never fires and the whole
  // app's navigation queue deadlocks — the "URL changes but nothing
  // transitions, then every navigation goes dead" failure under rapid
  // back/forward across a nested Router boundary. A disposed sync's tasks
  // abort on arrival instead, and the queue drains.
  let disposed = false;

  // Traversals of THIS sync currently queued or replaying. The convergence pass
  // below must stay silent while this is non-zero: the global task queue can
  // read as momentarily empty in the gap between one transition resolving and
  // the next parking, and a convergence firing in that gap would jump the store
  // to the browser's (far-ahead) live entry — every queued in-between event then
  // arrives "already passed" and its screen never shows. That was the "middle
  // transitions skipped on a rapid forward run" bug.
  let inFlight = 0;

  // Queue one traversal for replay. Split from the popstate listener so the
  // convergence pass below can re-drive the browser's present entry through the
  // SAME classifier without touching the self-pop guard (a heal must never eat
  // a `consume()` mark that belongs to a real flemo-induced popstate).
  const processTraversal = async (event: HistoryNavEvent) => {
    const frame = event.state as PopStateFrame | null;
    // The timeline epoch at the moment this traversal happened (see
    // HistoryStore.truncationEpoch).
    const eventEpoch = stores.history.getState().truncationEpoch;
    const taskId = TaskManager.generateTaskId();

    inFlight += 1;
    try {
      await runTraversalTask(event, frame, eventEpoch, taskId);
    } finally {
      inFlight -= 1;
    }
  };

  const runTraversalTask = async (
    event: HistoryNavEvent,
    frame: PopStateFrame | null,
    eventEpoch: number,
    taskId: string
  ) => {
    (
      await TaskManager.addTask(
        async (abortController) => {
          // Queued before the Router died, running after: bail out before
          // touching the stores or starting an unfinishable transition.
          if (disposed) {
            abortController.abort();
            return;
          }

          // An entry outside this Router's route space — a foreign zone's, even
          // if a copied frame under our key rides on it (see ownsPathname).
          if (deps.ownsPathname && !deps.ownsPathname(event.pathname)) {
            abortController.abort();
            return;
          }

          const { setStatus, setTransitionTaskId } = stores.navigate.getState();
          const { index, histories, addHistory, popHistory, setPendingIndex } =
            stores.history.getState();

          // Every queued traversal REPLAYS with its full transition — late but
          // complete — as long as the browser timeline it happened on is still
          // intact. Only when this Router rewrote the timeline since the event
          // fired (a push truncated the forward stack, a replace swapped an
          // entry — the epoch moved) can a stale event reference a DESTROYED
          // entry, and materializing it then would walk the store away from
          // the browser (proven by the convergence property test). In that
          // case only an event still describing the browser's present entry
          // may materialize; the rest fold, and whatever moved the browser
          // owns the convergence.
          if (eventEpoch !== stores.history.getState().truncationEpoch) {
            const presentFrame = driver.readState() as PopStateFrame | null;
            if (presentFrame?.id !== (event.state as PopStateFrame | null)?.id) {
              abortController.abort();
              return;
            }
          }

          // Classification is IDENTITY-FIRST: local indexes live in this
          // store's compressed space while frame indexes live in the browser's,
          // and after a jump into unread territory the two disagree forever —
          // comparing them mis-reads normal traversals (a plain back looked
          // "unclassifiable" and even duplicated entries). An entry we already
          // hold is found by id; only entries we've NEVER held fall back to a
          // browser-stamp direction test.
          if (!frame?.id) {
            abortController.abort();
            return;
          }

          const targetPosition = histories.findIndex((history) => history.id === frame.id);

          if (targetPosition === index) {
            abortController.abort();
            return;
          }

          const eventEntry = {
            id: frame.id,
            pathname: event.pathname,
            params: frame.params,
            transitionName: frame.transitionName,
            layoutId: frame.layoutId,
            frameIndex: frame.index
          };

          if (targetPosition === -1) {
            const currentStamp = histories[index]?.frameIndex ?? index;
            const movesForward =
              frame.index > currentStamp &&
              (frame.status === "PUSHING" || frame.status === "REPLACING");

            if (!movesForward) {
              // Backward (or lateral) into an entry we never held: its data
              // lives in history entries we cannot read, so no faithful
              // animated reconstruction exists. Adopt it in place — the screen
              // always matches the URL, like a browser's own non-animated
              // restore.
              stores.history.getState().adoptHistory(eventEntry);
              abortController.abort();
              return;
            }

            // Forward into an entry we never held: an animated (re)entry. The
            // serial queue orders this task AFTER the crossing that reveals its
            // zone, so it always runs with its screens visible — a zone-internal
            // move never applies invisibly, and the LAST step of a rapid forward
            // run plays its transition like every other.
            setTransitionTaskId(taskId);
            setStatus(frame.status === "REPLACING" ? "REPLACING" : "PUSHING");
            addHistory(eventEntry);

            return async () => {
              setStatus("COMPLETED");
            };
          }

          // A pop to an entry we hold: ONE screen per transition, chained. A coalesced browser
          // traversal (two rapid Back presses can arrive as a single -2 event)
          // must still show every intermediate screen — screens are never
          // skipped, the sequence just runs one full transition at a time. Pop a
          // single level now; if the event's target lies further down, the
          // completion re-drives the same event, which classifies against the
          // new top and pops the next level — sequential, in order, until the
          // target is reached.
          const stepTarget = index - 1;

          setTransitionTaskId(taskId);
          setPendingIndex(stepTarget);
          setStatus("POPPING");

          return async () => {
            popHistory(stepTarget + 1);
            setStatus("COMPLETED");
            if (stepTarget > targetPosition && !disposed) {
              void processTraversal(event);
            }
          };
        },
        {
          id: taskId,
          control: {
            manual: true,
            // Drain the gate even if this transition's animationend is lost
            // (screen frozen/torn down mid-storm) — see Control.maxLifetimeMs.
            maxLifetimeMs: TRANSITION_GATE_BACKSTOP_MS
          }
        }
      )
    ).result?.();
  };

  // ── Convergence guarantee ─────────────────────────────────────────────────
  // The serial queue replays each traversal behind the previous transition's
  // animationend gate — intentionally sequential. But a rapid storm can leave
  // the CONTENT permanently behind the URL in two ways: a gate whose resolve
  // signal was lost (drained by the task backstop), and events the epoch check
  // folded whose target then never materializes — nothing arrives afterwards to
  // move the store, so the mismatch would persist until a remount. This pass
  // runs only when the queue is idle AND no traversal has arrived for a quiet
  // beat (an active human sequence is never interrupted), compares the store's
  // active entry against the address bar, and re-drives the browser's PRESENT
  // entry through the normal classifier: it lands as an animated forward/pop
  // onto a held entry, or a browser-style in-place adopt for one we never held.
  // It re-arms until the store reaches the URL, so the content always catches
  // up — and it's a no-op on every ordinary navigation.
  //
  // Guards, each one load-bearing:
  // - same-id: when the live frame under OUR key matches the active entry, the
  //   URL difference belongs to a NESTED Router's sub-path — a parent shell
  //   converging over it would tear the nested Router down (the duplicate-
  //   screen regression). Never acted on.
  // - no-frame: a foreign entry (not ours) — nothing to converge onto. Never
  //   acted on.
  // - stall-stop: consecutive idle checks that change nothing eventually stop
  //   the chain until a real traversal re-arms it. CRUCIALLY the skip cases
  //   above also go through the stall counter instead of dying immediately: a
  //   sibling Router's convergence can be about to swap the zone under us (its
  //   pass changes OUR live frame without any popstate ever firing), so one
  //   transient same-id/no-frame reading must not kill the chain for good —
  //   that was a permanent URL↔content mismatch after multi-generation storms.
  let healTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEventAt = 0;
  let stallSignature = "";
  let stallCount = 0;
  const HEAL_DEBOUNCE_MS = 150;
  const HEAL_QUIET_MS = 400;
  const HEAL_MAX_STALLS = 4;
  const clock = () => (typeof performance !== "undefined" ? performance.now() : Number.MAX_VALUE);

  const scheduleHeal = () => {
    if (disposed || typeof setTimeout === "undefined") return;
    if (healTimer) clearTimeout(healTimer);
    healTimer = setTimeout(function heal() {
      healTimer = null;
      if (disposed) return;

      // Still settling: our own traversals are queued or replaying (inFlight —
      // the global queue can read empty in the gap between one transition
      // resolving and the next parking, so it alone is NOT enough), a
      // transition is running, or a traversal just arrived. Not a stall —
      // the replay may still be working towards the live entry.
      if (
        inFlight > 0 ||
        TaskManager.pendingTaskIds.length > 0 ||
        clock() - lastEventAt < HEAL_QUIET_MS
      ) {
        healTimer = setTimeout(heal, HEAL_DEBOUNCE_MS);
        return;
      }

      const live = driver.readPathname();
      const { histories, index } = stores.history.getState();
      const active = histories[index];
      if (!active || active.pathname === live) {
        stallCount = 0;
        return; // converged — done until the next traversal re-arms us
      }

      // One re-arm attempt, stall-counted: identical consecutive idle readings
      // eventually put the chain to sleep (a shell sitting over a nested
      // sub-path is a steady state), while a changing state keeps it alive.
      const liveFrame = driver.readState() as PopStateFrame | null;
      const signature = `${index}:${active.id}:${liveFrame?.id ?? "-"}:${live}`;
      if (signature === stallSignature) {
        stallCount += 1;
        if (stallCount > HEAL_MAX_STALLS) return; // steady — wait for a real traversal
      } else {
        stallSignature = signature;
        stallCount = 0;
      }

      // Foreign entry, or a nested Router's sub-path: nothing for THIS Router
      // to converge — but keep watching (stall-counted) in case a sibling's
      // convergence is about to change what's under us.
      if (liveFrame?.id && liveFrame.id !== active.id) {
        void processTraversal({ state: liveFrame, pathname: live });
      }
      healTimer = setTimeout(heal, HEAL_DEBOUNCE_MS);
    }, HEAL_DEBOUNCE_MS);
  };

  const unsubscribe = driver.subscribe((event) => {
    if (disposed) return;
    lastEventAt = clock();
    scheduleHeal();
    recordTraversal(event.pathname);
    // A traversal flemo triggered itself. The navigation queue already owns it.
    if (consume()) return;
    return processTraversal(event);
  });

  // Replay the traversals this Router MISSED. A zone Router created mid-walk (a
  // rapid forward run crossing into its zone, or a fresh page whose zones are
  // recreated as the walk reaches them) mounts AFTER some of its own zone's
  // events already fired — nothing was subscribed under its key yet, so without
  // this the middles those events carried would simply never show, and only a
  // convergence jump would land the zone at the live entry. The module recorder
  // below heard them all (any live sync records every traversal, raw); replay
  // everything after this scope's seed entry through the normal classifier — in
  // order, each with its full transition, exactly as if the Router had been
  // alive when they fired.
  if (deps.routerKey && deps.zoneEntryId && liveEntryBelongsToZone(driver, deps.zoneEntryId)) {
    const seedPathname =
      stores.history.getState().histories[stores.history.getState().index]?.pathname;
    const tail = recordedTraversalsAfter(seedPathname);
    for (const recorded of tail) {
      void processTraversal({
        state: (recorded.raw as Record<string, unknown> | null)?.[deps.routerKey] ?? null,
        pathname: recorded.pathname
      });
    }
  }

  // Also arm once at mount: a Router (re)mounting behind the address bar — a
  // host rebuilt it mid-storm — converges without needing another traversal.
  scheduleHeal();

  return () => {
    disposed = true;
    if (healTimer) clearTimeout(healTimer);
    unsubscribe();
  };
}

// ── Traversal recorder ───────────────────────────────────────────────────────
// The ordered stream of every back/forward traversal since the app booted, with
// the RAW `history.state` (all Routers' keyed frames). Fed by every live sync's
// popstate wrapper — a traversal is recorded once even though every sync's
// wrapper fires for it (the microtask flag dedupes the synchronous fan-out).
// This is what lets a Router created mid-walk replay the events of its own zone
// that fired before it existed (see above). Session-lifetime; entries are tiny.
interface RecordedTraversal {
  raw: unknown;
  pathname: string;
}

const recordedTraversals: RecordedTraversal[] = [];
let traversalTickRecorded = false;

const recordTraversal = (pathname: string) => {
  if (traversalTickRecorded || typeof window === "undefined") return;
  traversalTickRecorded = true;
  queueMicrotask(() => {
    traversalTickRecorded = false;
  });
  recordedTraversals.push({ raw: window.history.state, pathname });
};

// The recorded traversals AFTER the most recent occurrence of `pathname` — the
// events a Router seeded on that entry has not seen. An unrecorded seed (a
// fresh boot, a first visit) has no tail.
const recordedTraversalsAfter = (pathname: string | undefined): RecordedTraversal[] => {
  if (!pathname) return [];
  for (let i = recordedTraversals.length - 1; i >= 0; i -= 1) {
    if (recordedTraversals[i].pathname === pathname) {
      return recordedTraversals.slice(i + 1);
    }
  }
  return [];
};

// Whether the browser's CURRENT entry belongs to the zone identified by its
// enclosing screen's entry id: some Router's frame on the live entry carries
// that id (the shell's frame inside a zone is the zone's own shell entry, and
// it is copied across the zone's sub-entries). Read from the raw state so no
// specific key needs to be known.
const liveEntryBelongsToZone = (driver: HistoryDriver, zoneEntryId: string): boolean => {
  if (typeof window === "undefined") return false;
  void driver;
  const raw = window.history.state as Record<string, unknown> | null;
  if (!raw) return false;
  return Object.values(raw).some(
    (value) => !!value && typeof value === "object" && (value as { id?: string }).id === zoneEntryId
  );
};

// The most recent recorded frame for `routerKey` on the entry at `pathname` —
// the identity a Router being created on that entry should seed with, so its
// stack lines up with the frames already written to the browser's timeline
// (reading the LIVE entry instead would adopt a position the walk has already
// moved past, folding every event in between).
export function readRecordedFrame(routerKey: string, pathname: string): unknown {
  for (let i = recordedTraversals.length - 1; i >= 0; i -= 1) {
    if (recordedTraversals[i].pathname === pathname) {
      return (recordedTraversals[i].raw as Record<string, unknown> | null)?.[routerKey] ?? null;
    }
  }
  return null;
}

// ── Scope-bound sync lifetime ───────────────────────────────────────────────
// One live sync per Router scope. A PERSISTENT scope (a nested Router's, kept
// for the session across zone exits) must keep hearing traversals while its
// Router is frozen offscreen or torn down — the serial task queue orders each
// zone-internal move AFTER the crossing that reveals its zone, so by the time
// it runs the zone is visible and it animates in sequence like every other
// step. So a persistent scope's sync is created once and never disposed with
// the component; a non-persistent (root) scope's sync follows its binding's
// mount/unmount as before. Framework-neutral policy: a binding calls `ensure`
// from its mount lifecycle and `release` from its teardown, and this module
// decides what those mean per scope.
interface SyncScope {
  history: HistoryStoreApi;
  navigate: NavigateStoreApi;
  driver: HistoryDriver;
  consume: () => boolean;
  persistent?: boolean;
  routerKey?: string;
  zoneEntryId?: string;
  ownsPathname?: (pathname: string) => boolean;
}

const scopeSyncs = new WeakMap<SyncScope, () => void>();

export function ensureScopeHistorySync(scope: SyncScope): void {
  if (scopeSyncs.has(scope)) return;
  scopeSyncs.set(
    scope,
    createHistorySync({
      stores: scope,
      driver: scope.driver,
      consume: scope.consume,
      routerKey: scope.routerKey,
      zoneEntryId: scope.zoneEntryId,
      ownsPathname: scope.ownsPathname
    })
  );
}

export function releaseScopeHistorySync(scope: SyncScope): void {
  if (scope.persistent) return;
  scopeSyncs.get(scope)?.();
  scopeSyncs.delete(scope);
}

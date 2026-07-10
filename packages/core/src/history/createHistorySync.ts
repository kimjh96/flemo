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
  // The owning Router's liveness (see FlemoStores.life). A PERSISTENT sync (one
  // whose scope outlives its Router across zone exits — `alive` false while the
  // zone is frozen offscreen or torn down) still processes every traversal, but
  // applies the store move INSTANTLY instead of running a transition: nothing is
  // visible to animate, no `animationend` can arrive, and by the time the zone
  // is revealed again its content already sits on the right entry — the reveal
  // never snaps and the visible steps that follow animate normally.
  life?: { alive: boolean };
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
  const {
    stores,
    driver = createBrowserHistoryDriver(),
    consume = consumeSelfInducedPop,
    life
  } = deps;

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

    (
      await TaskManager.addTask(
        async (abortController) => {
          // Queued before the Router died, running after: bail out before
          // touching the stores or starting an unfinishable transition.
          if (disposed) {
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
            // No frame under our key: a foreign entry (another Router's
            // territory, or pre-flemo). Not ours to handle.
            abortController.abort();
            return;
          }

          const targetPosition = histories.findIndex((history) => history.id === frame.id);

          if (targetPosition === index) {
            // The entry we're already showing — a child Router or a step
            // navigation moving within it. Nothing to do at this level.
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

            // Forward into an entry we never held: an animated (re)entry — or,
            // for a zone currently offscreen (frozen or torn down; see
            // HistorySyncDeps.life), an INSTANT one: nothing is visible to
            // animate and no animationend can arrive, so the store just lands on
            // the entry. When the zone is revealed it's already correct, and the
            // visible steps that follow animate normally.
            if (life && !life.alive) {
              addHistory(eventEntry);
              stores.history.getState().setPendingIndex(stores.history.getState().index);
              abortController.abort();
              return;
            }
            setTransitionTaskId(taskId);
            setStatus(frame.status === "REPLACING" ? "REPLACING" : "PUSHING");
            addHistory(eventEntry);

            return async () => {
              setStatus("COMPLETED");
            };
          }

          // A pop to an entry we hold — offscreen zones land instantly (same
          // reasoning as above): truncate straight to the target with no
          // transition, so the eventual reveal shows the right screen at once.
          if (life && !life.alive) {
            stores.history.getState().truncateHistory(targetPosition);
            abortController.abort();
            return;
          }

          // Visible: ONE screen per transition, chained. A coalesced browser
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
  //   screen regression). Skip.
  // - no-frame: a foreign entry (not ours) — nothing to converge onto. Skip.
  // - stall-stop: if two attempts change nothing, stop re-arming until a real
  //   traversal arrives, so an unconvergeable state can't spin the queue.
  let healTimer: ReturnType<typeof setTimeout> | null = null;
  let lastEventAt = 0;
  let stallSignature = "";
  let stallCount = 0;
  const HEAL_DEBOUNCE_MS = 150;
  const HEAL_QUIET_MS = 400;
  const HEAL_MAX_STALLS = 2;
  const clock = () => (typeof performance !== "undefined" ? performance.now() : Number.MAX_VALUE);

  const scheduleHeal = () => {
    if (disposed || typeof setTimeout === "undefined") return;
    if (healTimer) clearTimeout(healTimer);
    healTimer = setTimeout(function heal() {
      healTimer = null;
      if (disposed) return;

      // Still settling: a transition is running or a traversal just arrived.
      if (TaskManager.pendingTaskIds.length > 0 || clock() - lastEventAt < HEAL_QUIET_MS) {
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

      const liveFrame = driver.readState() as PopStateFrame | null;
      if (!liveFrame?.id || liveFrame.id === active.id) {
        return; // foreign entry, or a nested Router's sub-path — not ours to converge
      }

      const signature = `${index}:${active.id}:${liveFrame.id}:${live}`;
      if (signature === stallSignature) {
        stallCount += 1;
        if (stallCount > HEAL_MAX_STALLS) return; // no progress — wait for a real traversal
      } else {
        stallSignature = signature;
        stallCount = 0;
      }

      void processTraversal({ state: liveFrame, pathname: live });
      healTimer = setTimeout(heal, HEAL_DEBOUNCE_MS);
    }, HEAL_DEBOUNCE_MS);
  };

  const unsubscribe = driver.subscribe((event) => {
    if (disposed) return;
    lastEventAt = clock();
    scheduleHeal();
    // A traversal flemo triggered itself. The navigation queue already owns it.
    if (consume()) return;
    return processTraversal(event);
  });
  // Also arm once at mount: a Router (re)mounting behind the address bar — a
  // host rebuilt it mid-storm — converges without needing another traversal.
  scheduleHeal();

  return () => {
    disposed = true;
    if (healTimer) clearTimeout(healTimer);
    unsubscribe();
  };
}

// ── Scope-bound sync lifetime ───────────────────────────────────────────────
// One live sync per Router scope. A PERSISTENT scope (a nested Router's, kept
// for the session across zone exits) must keep hearing traversals while its
// Router is frozen offscreen or torn down — the sync applies those moves
// instantly (see `life` above), so the zone is already on the right entry
// whenever it is revealed and nothing ever snaps or stops animating. So a
// persistent scope's sync is created once and never disposed with the
// component; a non-persistent (root) scope's sync follows its binding's
// mount/unmount as before. Framework-neutral policy: a binding calls `ensure`
// from its mount lifecycle and `release` from its teardown, and this module
// decides what those mean per scope.
interface SyncScope {
  history: HistoryStoreApi;
  navigate: NavigateStoreApi;
  driver: HistoryDriver;
  consume: () => boolean;
  persistent?: boolean;
  life: { alive: boolean };
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
      life: scope.life
    })
  );
}

export function releaseScopeHistorySync(scope: SyncScope): void {
  if (scope.persistent) return;
  scopeSyncs.get(scope)?.();
  scopeSyncs.delete(scope);
}

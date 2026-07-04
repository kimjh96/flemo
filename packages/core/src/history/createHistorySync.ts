import TaskManager from "@core/TaskManger";

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

  const handlePopState = async (event: HistoryNavEvent) => {
    if (disposed) {
      return;
    }

    // A traversal flemo triggered itself. The navigation queue already owns it.
    if (consume()) {
      return;
    }

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
          const { index, histories, addHistory, popHistory, popHistories, setPendingIndex } =
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

            // Forward into an entry we never held: an animated (re)entry.
            setTransitionTaskId(taskId);
            setStatus(frame.status === "REPLACING" ? "REPLACING" : "PUSHING");
            addHistory(eventEntry);

            return async () => {
              setStatus("COMPLETED");
            };
          }

          // A pop to an entry we hold. Drop any skipped screens between the
          // target and the top in the same synchronous block (they never
          // paint), then animate top → target like a single-step pop.
          const skipped = index - targetPosition - 1;

          setTransitionTaskId(taskId);
          if (skipped > 0) {
            popHistories(skipped);
          }
          setPendingIndex(targetPosition);
          setStatus("POPPING");

          return async () => {
            popHistory(targetPosition + 1);
            setStatus("COMPLETED");
          };
        },
        {
          id: taskId,
          control: {
            manual: true
          }
        }
      )
    ).result?.();
  };

  const unsubscribe = driver.subscribe(handlePopState);
  return () => {
    disposed = true;
    unsubscribe();
  };
}

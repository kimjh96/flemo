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
          const { index, addHistory, popHistory, setPendingIndex } = stores.history.getState();

          const nextIndex = frame?.index;
          const isPop = nextIndex !== undefined && nextIndex < index;
          const isPush =
            frame?.status === "PUSHING" && nextIndex !== undefined && nextIndex > index;
          const isReplace =
            frame?.status === "REPLACING" && nextIndex !== undefined && nextIndex > index;

          if (!isPop && !isPush && !isReplace) {
            // Unclassifiable, but the entry verifiably belongs to this Router
            // (it carries a frame under our key) and is NOT the entry we're
            // showing: adopt it without a transition — rewrite the current top
            // to the event's entry so the screen always matches the URL. This
            // is the degraded-but-correct path for traversals whose
            // intermediate entries this Router never saw (e.g. a forward jump
            // into territory written before a remount): their data lives in
            // other history entries we cannot read, so no faithful animated
            // reconstruction exists — matching a browser's own non-animated
            // restore is the honest behavior. A same-id event is a foreign
            // sub-navigation (a nested Router moving within our entry) and
            // stays a no-op.
            const currentEntry = stores.history.getState().histories[index];
            if (frame?.id && currentEntry && frame.id !== currentEntry.id) {
              stores.history.getState().adoptHistory({
                id: frame.id,
                pathname: event.pathname,
                params: frame.params,
                transitionName: frame.transitionName,
                layoutId: frame.layoutId
              });
            }
            abortController.abort();
            return;
          }

          setTransitionTaskId(taskId);

          if (isPop) {
            // Report the destination immediately; the actual index only moves
            // when the transition resolves (popHistory below).
            setPendingIndex(nextIndex);
            setStatus("POPPING");
          } else {
            // A push or replace: the guard above ruled out everything else, so
            // isPush/isReplace held, both of which require a frame.
            const pushed = frame!;
            setStatus(isPush ? "PUSHING" : "REPLACING");

            addHistory({
              id: pushed.id,
              pathname: event.pathname,
              params: pushed.params,
              transitionName: pushed.transitionName,
              layoutId: pushed.layoutId
            });
          }

          return async () => {
            if (isPop && nextIndex !== undefined) {
              popHistory(nextIndex + 1);
            }

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

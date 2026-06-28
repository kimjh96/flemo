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
  const { stores, driver = createBrowserHistoryDriver() } = deps;

  const handlePopState = async (event: HistoryNavEvent) => {
    // A traversal flemo triggered itself. The navigation queue already owns it.
    if (consumeSelfInducedPop()) {
      return;
    }

    const frame = event.state as PopStateFrame | null;
    const taskId = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { setStatus, setTransitionTaskId } = stores.navigate.getState();
          const { index, addHistory, popHistory } = stores.history.getState();

          const nextIndex = frame?.index;
          const isPop = nextIndex !== undefined && nextIndex < index;
          const isPush =
            frame?.status === "PUSHING" && nextIndex !== undefined && nextIndex > index;
          const isReplace =
            frame?.status === "REPLACING" && nextIndex !== undefined && nextIndex > index;

          if (!isPop && !isPush && !isReplace) {
            abortController.abort();
            return;
          }

          setTransitionTaskId(taskId);

          if (isPop) {
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

  return driver.subscribe(handlePopState);
}

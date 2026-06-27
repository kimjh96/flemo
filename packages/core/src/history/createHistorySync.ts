import TaskManager from "@core/TaskManger";

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
}

// Bridge the browser Back/Forward (popstate) into flemo's navigation queue:
// classify the event against the current stack (pop / push / replace), park a
// manual-gated task, mutate the stores, and resolve on completion. flemo-induced
// popstates are filtered via the self-pop guard. Framework-neutral: attaches the
// listener and returns a disposer; a binding calls it from its own effect.
export default function createHistorySync(deps: HistorySyncDeps): () => void {
  const { stores } = deps;

  const handlePopState = async (e: PopStateEvent) => {
    // A popstate flemo triggered itself. The navigation queue already owns it.
    if (consumeSelfInducedPop()) {
      return;
    }

    const nextId = e.state?.id;
    const taskId = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const nextIndex = e.state?.index;
          const nextStatus = e.state?.status as NavigateStatus;
          const nextParams = e.state?.params;
          const nextTransitionName = e.state?.transitionName as TransitionName;
          const nextLayoutId = e.state?.layoutId as string | number | null;
          const { setStatus, setTransitionTaskId } = stores.navigate.getState();
          const { index, addHistory, popHistory } = stores.history.getState();
          const isPop = nextIndex < index;
          const isPush = nextStatus === "PUSHING" && nextIndex > index;
          const isReplace = nextStatus === "REPLACING" && nextIndex > index;
          const pathname = window.location.pathname;

          if (!isPop && !isPush && !isReplace) {
            abortController.abort();
            return;
          }

          setTransitionTaskId(taskId);

          if (isPop) {
            setStatus("POPPING");
          } else if (isPush) {
            setStatus("PUSHING");

            addHistory({
              id: nextId,
              pathname,
              params: nextParams,
              transitionName: nextTransitionName,
              layoutId: nextLayoutId
            });
          } else if (isReplace) {
            setStatus("REPLACING");

            addHistory({
              id: nextId,
              pathname,
              params: nextParams,
              transitionName: nextTransitionName,
              layoutId: nextLayoutId
            });
          }

          return async () => {
            if (isPop) {
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

  window.addEventListener("popstate", handlePopState);

  return () => {
    window.removeEventListener("popstate", handlePopState);
  };
}

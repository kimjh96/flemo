import { useEffect } from "react";

import taskManager from "@core/TaskManger";

import useHistoryStore from "@history/store";

import useNavigationStore from "@navigate/store";

import type { NavigateStatus } from "@navigate/store";
import type { TransitionName } from "@transition/typing";

function HistoryListener() {
  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      await taskManager.resolveAllPending();

      const { index, addHistory, popHistory } = useHistoryStore.getState();
      const setStatus = useNavigationStore.getState().setStatus;
      const nextId = e.state?.id;
      const nextIndex = e.state?.index;
      const nextStatus = e.state?.status as NavigateStatus;
      const nextParams = e.state?.params;
      const nextTransitionName = e.state?.transitionName as TransitionName;

      const isPop = nextIndex < index;
      const isPush = nextStatus === "PUSHING" && nextIndex > index;
      const isReplace = nextStatus === "REPLACING" && nextIndex > index;

      if (isPop) {
        (
          await taskManager.addTask(
            async () => {
              setStatus("POPPING");

              return async () => {
                popHistory(nextIndex + 1);

                if (!taskManager.getManualPendingTasks().length) {
                  setStatus("COMPLETED");
                }
              };
            },
            {
              id: nextId,
              control: {
                manual: true
              }
            }
          )
        )?.result?.();
      } else if (isPush) {
        (
          await taskManager.addTask(
            async () => {
              setStatus("PUSHING");

              addHistory({
                id: nextId,
                pathname: window.location.pathname,
                params: nextParams,
                transitionName: nextTransitionName
              });

              return async () => {
                if (!taskManager.getManualPendingTasks().length) {
                  setStatus("COMPLETED");
                }
              };
            },
            {
              id: nextId,
              control: {
                manual: true
              }
            }
          )
        )?.result?.();
      } else if (isReplace) {
        (
          await taskManager.addTask(
            async () => {
              setStatus("REPLACING");

              addHistory({
                id: nextId,
                pathname: window.location.pathname,
                params: nextParams,
                transitionName: nextTransitionName
              });

              return async () => {
                if (!taskManager.getManualPendingTasks().length) {
                  setStatus("COMPLETED");
                }
              };
            },
            {
              id: nextId,
              control: {
                manual: true
              }
            }
          )
        )?.result?.();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  return null;
}

export default HistoryListener;

import { useEffect } from "react";

import TaskManager from "@core/TaskManger";

import useHistoryStore from "@history/store";

import { consumeSelfInducedPop } from "@navigate/selfPopGuard";
import useNavigationStore from "@navigate/store";

import type { NavigateStatus } from "@navigate/store";

import type { TransitionName } from "@transition/typing";

function HistoryListener() {
  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      // A popstate flemo triggered itself — the navigation queue already owns it.
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
            const { setStatus, setTransitionTaskId } = useNavigationStore.getState();
            const { index, addHistory, popHistory } = useHistoryStore.getState();
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
  }, []);

  return null;
}

export default HistoryListener;

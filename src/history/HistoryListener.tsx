import { useEffect } from "react";

import TaskManager from "@core/TaskManger";

import useHistoryStore from "@history/store";

import useNavigationStore from "@navigate/store";

import type { NavigateStatus } from "@navigate/store";
import type { TransitionName } from "@transition/typing";

function HistoryListener() {
  useEffect(() => {
    const handlePopState = async (e: PopStateEvent) => {
      const nextId = e.state?.id;
      const nextIndex = e.state?.index;
      const nextStatus = e.state?.status as NavigateStatus;
      const nextParams = e.state?.params;
      const nextTransitionName = e.state?.transitionName as TransitionName;
      const setStatus = useNavigationStore.getState().setStatus;
      const { index, addHistory, popHistory } = useHistoryStore.getState();
      const isPop = nextIndex < index;
      const isPush = nextStatus === "PUSHING" && nextIndex > index;
      const isReplace = nextStatus === "REPLACING" && nextIndex > index;
      const pathname = window.location.pathname;

      if (!isPop && !isPush && !isReplace) {
        return;
      }

      (
        await TaskManager.addTask(
          async () => {
            if (isPop) {
              setStatus("POPPING");
            } else if (isPush) {
              setStatus("PUSHING");

              addHistory({
                id: nextId,
                pathname,
                params: nextParams,
                transitionName: nextTransitionName
              });
            } else if (isReplace) {
              setStatus("REPLACING");

              addHistory({
                id: nextId,
                pathname,
                params: nextParams,
                transitionName: nextTransitionName
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
            id: nextId,
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

import TaskManager from "@core/TaskManger";

import useHistoryStore from "@history/store";

import useNavigationStore from "@navigate/store";

import useTransitionStore from "@transition/store";

import type { TransitionName } from "@transition/typing";

import buildRoutePath from "@utils/buildRoutePath";

import type { RegisterRoute } from "@Route";

export default function useNavigate() {
  const push = async <T extends keyof RegisterRoute>(
    path: T,
    params?: RegisterRoute[T],
    options?: {
      layoutId?: string | number;
      transitionName?: TransitionName;
    }
  ) => {
    const { status, setStatus } = useNavigationStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const { index, addHistory } = useHistoryStore.getState();

    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;

    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          setStatus("PUSHING");

          const { pathname, toPathname } = buildRoutePath(path, (params ?? {}) as RegisterRoute[T]);

          window.history.pushState(
            {
              id,
              index: index + 1,
              status: "PUSHING",
              params,
              transitionName,
              layoutId
            },
            "",
            pathname
          );

          addHistory({
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          });

          return () => {
            setStatus("COMPLETED");
          };
        },
        {
          id,
          control: {
            manual: true
          }
        }
      )
    ).result?.();
  };

  const replace = async <T extends keyof RegisterRoute>(
    path: T,
    params?: RegisterRoute[T],
    options?: {
      layoutId?: string | number;
      transitionName?: TransitionName;
    }
  ) => {
    const { status, setStatus } = useNavigationStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const { index, addHistory } = useHistoryStore.getState();
    const replaceHistory = useHistoryStore.getState().replaceHistory;
    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;

    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          setStatus("REPLACING");

          const { pathname, toPathname } = buildRoutePath(path, (params ?? {}) as RegisterRoute[T]);

          window.history.replaceState(
            {
              id,
              index,
              status: "REPLACING",
              params,
              transitionName,
              layoutId
            },
            "",
            pathname
          );

          addHistory({
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          });

          return async () => {
            replaceHistory(index);

            setStatus("COMPLETED");
          };
        },
        {
          id,
          control: {
            manual: true
          }
        }
      )
    ).result?.();
  };

  const pop = () => {
    const status = useNavigationStore.getState().status;

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    window.history.back();
  };

  return {
    push,
    replace,
    pop
  };
}

import {
  markSelfInducedPop,
  TaskManger as TaskManager,
  useHistoryStore,
  useNavigateStore,
  useTransitionStore,
  type TransitionName
} from "@flemo/core";

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
    const { status } = useNavigateStore.getState();

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
          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();

          setStatus("PUSHING");
          setTransitionTaskId(id);

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
    const { status } = useNavigateStore.getState();

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
          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();

          setStatus("REPLACING");
          setTransitionTaskId(id);

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

  const pop = async (count = 1) => {
    // A non-positive count is an explicit no-op (distinct from the default
    // pop() which is count === 1). Don't enqueue anything.
    if (count <= 0) {
      return;
    }

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { index, popHistory, popHistories } = useHistoryStore.getState();

          // Nothing below the root to pop — no-op without touching the browser.
          if (index <= 0) {
            abortController.abort();
            return;
          }

          // Clamp to the available depth so pop(n) past the root lands on the
          // root rather than over-popping.
          const steps = Math.min(count, index);

          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();

          setStatus("POPPING");
          setTransitionTaskId(id);

          // Drop the n-1 skipped screens synchronously — same block as
          // setStatus, before the browser can paint — so they never appear.
          // The leaving top stays mounted; the destination becomes the visible
          // previous and the transition reduces to a normal 1-step pop.
          // popHistories(0) is a no-op, so steps === 1 takes the exact same
          // path the single-step pop always has.
          popHistories(steps - 1);

          // flemo drives the browser; its own popstate is filtered in HistoryListener.
          markSelfInducedPop();
          if (steps === 1) {
            window.history.back();
          } else {
            window.history.go(-steps);
          }

          return async () => {
            // Remove the leaving top, read live so it's correct after the
            // intermediate drop shifted the index.
            popHistory(useHistoryStore.getState().index);
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

  return {
    push,
    replace,
    pop
  };
}

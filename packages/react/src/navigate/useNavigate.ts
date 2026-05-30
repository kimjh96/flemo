import { pathToRegexp } from "path-to-regexp";

import {
  markSelfInducedPop,
  TaskManger as TaskManager,
  useHistoryStore,
  useNavigateStore,
  useTransitionStore,
  type History,
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

  // Shared engine for pop(n) and popTo(path). `resolveSteps` runs inside the
  // task — with the live history — and returns how many screens to pop. A
  // result <= 0 is a no-op (e.g. popTo found no match). Whatever the count,
  // the skipped screens are removed synchronously in the same block that flips
  // to POPPING (before the browser paints), so they never appear; the leaving
  // top stays mounted to drive and resolve the animation.
  const runPop = async (resolveSteps: (index: number, histories: History[]) => number) => {
    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { index, histories, popHistory, popHistories } = useHistoryStore.getState();

          // Nothing below the root to pop — no-op without touching the browser.
          if (index <= 0) {
            abortController.abort();
            return;
          }

          // Clamp to the available depth so popping past the root lands on the
          // root rather than over-popping.
          const steps = Math.min(resolveSteps(index, histories), index);

          if (steps <= 0) {
            abortController.abort();
            return;
          }

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

  const pop = async (count = 1) => {
    // A non-positive count is an explicit no-op (distinct from the default
    // pop() which is count === 1). Don't enqueue anything.
    if (count <= 0) {
      return;
    }

    await runPop((index) => Math.min(count, index));
  };

  // Pop back to the nearest screen below the top whose route matches `path`.
  // Searches from just under the top toward the root and stops at the first
  // match, so duplicates resolve to the closest one. No match → no-op. The
  // current top is never considered a target. `path` is a registered route
  // pattern (e.g. "/album/:id"), matched against each entry's resolved
  // pathname the same way the renderer assigns screens to routes.
  const popTo = async <T extends keyof RegisterRoute>(path: T) => {
    await runPop((index, histories) => {
      const { regexp } = pathToRegexp(path as string);
      for (let i = index - 1; i >= 0; i--) {
        if (regexp.test(histories[i].pathname)) {
          return index - i;
        }
      }
      return 0;
    });
  };

  return {
    push,
    replace,
    pop,
    popTo
  };
}

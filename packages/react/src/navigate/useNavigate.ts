import { pathToRegexp } from "path-to-regexp";

import {
  consumeSelfInducedPop,
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

// How far a pop / replace / push reaches into the existing stack — `skip`
// screens, or back until the nearest screen matching the `until` route pattern.
// They reach the same target (the screen `skip` below the top ≡ the matched
// screen): pop lands on it, replace replaces it, push keeps it and stacks on
// top. Mutually exclusive — `until` wins if both are given.
interface DistanceOptions {
  skip?: number;
  until?: keyof RegisterRoute;
}

// Distance from the top to the nearest screen below it whose route matches
// `path`'s pattern (searched top → root, so duplicates resolve to the closest),
// or -1 if none. Matches each entry's resolved pathname the same way the
// renderer assigns screens to routes. The current top is never a target.
const matchDistance = (path: string, index: number, histories: History[]): number => {
  const { regexp } = pathToRegexp(path);
  for (let i = index - 1; i >= 0; i--) {
    if (regexp.test(histories[i].pathname)) {
      return index - i;
    }
  }
  return -1;
};

// Sync the browser history for a collapse (replace / push): go back to where
// the new screen will sit, await flemo's own popstate (HistoryListener filters
// it), then pushState the new entry. pushState truncates the forward stack so
// there are no phantom entries — the browser ends matching the in-memory stack
// exactly (length, index, back/forward targets). On a missing popstate it
// rebalances the self-pop guard and leaves the browser as-is (the in-memory
// store stays the source of truth and the visual still resolves).
const syncCollapsedHistory = async (goBack: number, state: object, pathname: string) => {
  const popstateFired = new Promise<unknown>((resolve) => {
    window.addEventListener("popstate", (event: PopStateEvent) => resolve(event.state), {
      once: true
    });
  });
  const safetyTimeout = new Promise<undefined>((resolve) =>
    setTimeout(() => resolve(undefined), 200)
  );

  markSelfInducedPop();
  window.history.go(-goBack);
  const settled = await Promise.race([popstateFired, safetyTimeout]);

  if (settled === undefined) {
    consumeSelfInducedPop();
    return;
  }
  window.history.pushState(state, "", pathname);
};

export default function useNavigate() {
  const push = async <T extends keyof RegisterRoute>(
    path: T,
    params?: RegisterRoute[T],
    options?: DistanceOptions & {
      layoutId?: string | number;
      transitionName?: TransitionName;
    }
  ) => {
    const { status } = useNavigateStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;
    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          const { index, histories, addHistory, popHistories } = useHistoryStore.getState();

          // Screens to remove below the new top — reaching the target (`skip`
          // below the top, or the matched `until` screen), which is kept with
          // the new screen stacked on top. An unmatched `until` falls back to a
          // plain push (removes nothing).
          const remove = (() => {
            if (options?.until != null) {
              const distance = matchDistance(options.until, index, histories);
              return distance < 0 ? 0 : distance;
            }
            const skip = options?.skip ?? 0;
            return skip <= 0 ? 0 : Math.min(skip, index);
          })();

          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();

          setStatus("PUSHING");
          setTransitionTaskId(id);

          const { pathname, toPathname } = buildRoutePath(path, (params ?? {}) as RegisterRoute[T]);

          const newEntry = {
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          };

          if (remove === 0) {
            // Plain push — the new screen stacks on the current top, unchanged.
            window.history.pushState(
              { id, index: index + 1, status: "PUSHING", params, transitionName, layoutId },
              "",
              pathname
            );
            addHistory(newEntry);

            return () => {
              setStatus("COMPLETED");
            };
          }

          // Collapse-push: stack the new screen normally (it enters over the
          // current top), then once it covers everything the resolver removes
          // the `remove` screens now hidden below it — so the skipped screens
          // never flash. The browser goes back to the kept target and
          // pushState's the new screen, truncating the forward stack.
          addHistory(newEntry);

          await syncCollapsedHistory(
            remove,
            {
              id,
              index: useHistoryStore.getState().index - remove,
              status: "PUSHING",
              params,
              transitionName,
              layoutId
            },
            pathname
          );

          return async () => {
            popHistories(remove);
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
    options?: DistanceOptions & {
      layoutId?: string | number;
      transitionName?: TransitionName;
    }
  ) => {
    const { status } = useNavigateStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;
    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { index, histories, addHistory, replaceHistory, popHistories } =
            useHistoryStore.getState();

          // How many screens the new one collapses (replaces). It reaches the
          // target — `skip` below the top, or the matched `until` screen — and
          // replaces it together with everything above, so it's the reach
          // distance plus one. `replace()` with no distance is the plain
          // single-screen replace (steps 1). Clamps to `index + 1` because
          // replace can collapse the root too. An unmatched `until` is a no-op.
          const steps = (() => {
            if (options?.until != null) {
              const distance = matchDistance(options.until, index, histories);
              return distance < 0 ? 0 : distance + 1;
            }
            const skip = options?.skip ?? 0;
            return skip < 0 ? 0 : Math.min(skip + 1, index + 1);
          })();

          if (steps <= 0) {
            abortController.abort();
            return;
          }

          const { setStatus, setTransitionTaskId } = useNavigateStore.getState();

          setStatus("REPLACING");
          setTransitionTaskId(id);

          const { pathname, toPathname } = buildRoutePath(path, (params ?? {}) as RegisterRoute[T]);

          const newEntry = {
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          };

          if (steps === 1) {
            // Single-screen replace — unchanged from the original behavior.
            window.history.replaceState(
              { id, index, status: "REPLACING", params, transitionName, layoutId },
              "",
              pathname
            );
            addHistory(newEntry);

            return async () => {
              replaceHistory(index);
              setStatus("COMPLETED");
            };
          }

          // Collapse: drop the steps-1 skipped screens synchronously — same
          // block as setStatus, before the browser can paint — so they never
          // appear. The leaving top stays mounted (REPLACING-false, exiting)
          // while the new screen enters over it (REPLACING-true).
          popHistories(steps - 1);
          addHistory(newEntry);

          await syncCollapsedHistory(
            steps,
            {
              id,
              index: useHistoryStore.getState().index - 1,
              status: "REPLACING",
              params,
              transitionName,
              layoutId
            },
            pathname
          );

          return async () => {
            // Remove the leaving top, read live so it's correct after the
            // intermediate drop and the new entry shifted the index.
            replaceHistory(useHistoryStore.getState().index - 1);
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

  // Shared engine for pop. `resolveSteps` runs inside the task — with the live
  // history — and returns how many screens to pop. A result <= 0 is a no-op
  // (e.g. an unmatched `until`, or a non-positive `count`). Whatever the count,
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

  // Go back `skip` screens, or back until the nearest screen matching `until`'s
  // route pattern (which stays — pop lands on it). Omitted → one screen. An
  // unmatched `until` or non-positive `skip` is a no-op.
  const pop = async (options?: DistanceOptions) => {
    await runPop((index, histories) => {
      if (options?.until != null) {
        const distance = matchDistance(options.until, index, histories);
        return distance < 0 ? 0 : distance;
      }
      const skip = options?.skip ?? 1;
      return skip <= 0 ? 0 : Math.min(skip, index);
    });
  };

  return {
    push,
    replace,
    pop
  };
}

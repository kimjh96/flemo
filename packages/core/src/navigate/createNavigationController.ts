import { pathToRegexp } from "path-to-regexp";

import TaskManager from "@core/TaskManger";

import createBrowserHistoryDriver, { type HistoryDriver } from "@history/historyDriver";
import type { History, HistoryStoreApi } from "@history/store";

import { markSelfInducedPop } from "@navigate/selfPopGuard";
import type { NavigateStoreApi } from "@navigate/store";

import type { TransitionStoreApi } from "@transition/store";
import type { TransitionName } from "@transition/typing";

// How far a pop / replace / push reaches into the existing stack. `skip`
// screens, or back until the nearest screen matching the `until` route pattern.
// They reach the same target (the screen `skip` below the top ≡ the matched
// screen): pop lands on it, replace replaces it, push keeps it and stacks on
// top. Mutually exclusive. `until` wins if both are given. `until` is a route
// pattern string here; the typed binding narrows it to its route registry.
export interface DistanceOptions {
  skip?: number;
  until?: string;
}

export interface NavigateOptions extends DistanceOptions {
  layoutId?: string | number;
  transitionName?: TransitionName;
}

export interface PopOptions extends DistanceOptions {
  transitionName?: TransitionName;
}

export interface NavigationControllerDeps {
  // The request-scoped stores (framework-neutral zustand vanilla stores).
  stores: {
    history: HistoryStoreApi;
    navigate: NavigateStoreApi;
    transition: TransitionStoreApi;
  };
  // Compile a route path + params into the pathname (with query) and the
  // resolved pathname stored on the history entry. Injected because the binding
  // owns the route registry / type surface (e.g. RegisterRoute in React).
  buildPathname: (path: string, params: object) => { pathname: string; toPathname: string };
  // The history backend. Defaults to the real browser History API; a nested
  // <Router> injects an in-memory driver so its navigation stays local.
  driver?: HistoryDriver;
  // Marks a flemo-induced traversal so the history sync ignores its own
  // popstate. Defaults to the global guard the root <Router> shares with the
  // sync; a nested <Router> (no global sync attached) injects a no-op so it
  // never touches that shared counter.
  markSelfInduced?: () => void;
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

// Coerce a `skip` option to a non-negative integer, falling back when it's
// missing or not a finite number (the typed API discourages NaN / floats, but
// guard the store against them anyway).
const toSkip = (value: number | undefined, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;

// Sync the browser history for a collapse (replace / push): go back `goBack` to
// where the new screen will sit, await flemo's own popstate (the history sync
// filters it), then run `commit` (a push/replaceState) so the browser ends
// matching the in-memory stack. `commit` distinguishes the two callers. Push
// and below-root replace pushState the new entry (truncating the forward
// stack); a root-collapsing replace can't go past index 0, so it goes to the
// root and replaceState's it instead.
//
// If no popstate arrives within the window the traversal was either slow or a
// no-op. We drop our one-shot listener and leave the self-pop mark for the
// history sync to consume (a slow popstate is far likelier than none, now that
// `goBack` never overshoots), and leave the browser as-is. The in-memory store
// stays the source of truth and the visual still resolves.
const syncCollapsedHistory = async (
  driver: HistoryDriver,
  markSelfInduced: () => void,
  goBack: number,
  commit: () => void
) => {
  let dispose!: () => void;
  const popstateFired = new Promise<boolean>((resolve) => {
    dispose = driver.subscribe(() => resolve(true));
  });
  const safetyTimeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 200));

  markSelfInduced();
  driver.go(-goBack);
  const fired = await Promise.race([popstateFired, safetyTimeout]);

  dispose();
  if (!fired) {
    return;
  }
  commit();
};

// Framework-neutral navigation engine: owns push / replace / pop orchestration
// (distance math, history-stack mutations, browser history sync, the task
// queue) over injected stores + a path compiler. A binding wires the stores
// from its own context and provides the typed wrappers.
export default function createNavigationController(deps: NavigationControllerDeps) {
  const {
    stores,
    buildPathname,
    driver = createBrowserHistoryDriver(),
    markSelfInduced = markSelfInducedPop
  } = deps;

  const push = async (path: string, params?: object, options?: NavigateOptions) => {
    const { status } = stores.navigate.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const defaultTransitionName = stores.transition.getState().defaultTransitionName;
    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          const { index, histories, addHistory, popHistories } = stores.history.getState();

          // Screens to remove below the new top, reaching the target (`skip`
          // below the top, or the matched `until` screen), which is kept with
          // the new screen stacked on top. An unmatched `until` falls back to a
          // plain push (removes nothing).
          const remove = (() => {
            if (options?.until != null) {
              const distance = matchDistance(options.until, index, histories);
              return distance < 0 ? 0 : distance;
            }
            // `Math.max(0, index)` so the first push (empty stack, index -1)
            // stays a plain push instead of a negative `remove`.
            return Math.min(toSkip(options?.skip, 0), Math.max(0, index));
          })();

          const { setStatus, setTransitionTaskId } = stores.navigate.getState();

          setStatus("PUSHING");
          setTransitionTaskId(id);

          const { pathname, toPathname } = buildPathname(path, params ?? {});

          const newEntry = {
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          };

          if (remove === 0) {
            // Plain push. The new screen stacks on the current top, unchanged.
            driver.pushState(
              { id, index: index + 1, status: "PUSHING", params, transitionName, layoutId },
              pathname
            );
            addHistory(newEntry);

            return () => {
              setStatus("COMPLETED");
            };
          }

          // Collapse-push: stack the new screen normally (it enters over the
          // current top), then once it covers everything the resolver removes
          // the `remove` screens now hidden below it, so the skipped screens
          // never flash. The browser goes back to the kept target and
          // pushState's the new screen, truncating the forward stack.
          addHistory(newEntry);

          await syncCollapsedHistory(driver, markSelfInduced, remove, () => {
            driver.pushState(
              {
                id,
                index: stores.history.getState().index - remove,
                status: "PUSHING",
                params,
                transitionName,
                layoutId
              },
              pathname
            );
          });

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

  const replace = async (path: string, params?: object, options?: NavigateOptions) => {
    const { status } = stores.navigate.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const defaultTransitionName = stores.transition.getState().defaultTransitionName;
    const { transitionName = defaultTransitionName, layoutId = null } = options ?? {};

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { index, histories, addHistory, replaceHistory, popHistories } =
            stores.history.getState();

          // How many screens the new one collapses (replaces). It reaches the
          // target (`skip` below the top, or the matched `until` screen) and
          // replaces it together with everything above, so it's the reach
          // distance plus one. `replace()` with no distance is the plain
          // single-screen replace (steps 1). Clamps to `index + 1` because
          // replace can collapse the root too. An unmatched `until` is a no-op.
          const steps = (() => {
            if (options?.until != null) {
              const distance = matchDistance(options.until, index, histories);
              return distance < 0 ? 0 : distance + 1;
            }
            return Math.min(toSkip(options?.skip, 0) + 1, index + 1);
          })();

          if (steps <= 0) {
            abortController.abort();
            return;
          }

          const { setStatus, setTransitionTaskId } = stores.navigate.getState();

          setStatus("REPLACING");
          setTransitionTaskId(id);

          const { pathname, toPathname } = buildPathname(path, params ?? {});

          const newEntry = {
            id,
            pathname: toPathname,
            params: params ?? {},
            transitionName,
            layoutId
          };

          if (steps === 1) {
            // Single-screen replace. Unchanged from the original behavior.
            driver.replaceState(
              { id, index, status: "REPLACING", params, transitionName, layoutId },
              pathname
            );
            addHistory(newEntry);

            return async () => {
              replaceHistory(index);
              setStatus("COMPLETED");
            };
          }

          // Collapse: drop the steps-1 skipped screens synchronously (same
          // block as setStatus, before the browser can paint) so they never
          // appear. The leaving top stays mounted (REPLACING-false, exiting)
          // while the new screen enters over it (REPLACING-true).
          popHistories(steps - 1);
          addHistory(newEntry);

          if (steps <= index) {
            // A screen remains below the new one. Go to it and pushState the
            // new entry above (truncating the forward stack, no phantoms).
            await syncCollapsedHistory(driver, markSelfInduced, steps, () => {
              driver.pushState(
                {
                  id,
                  index: stores.history.getState().index - 1,
                  status: "REPLACING",
                  params,
                  transitionName,
                  layoutId
                },
                pathname
              );
            });
          } else {
            // Collapsing the root: the new screen becomes the root. go(-steps)
            // would overshoot index 0, so go to the current root and
            // replaceState it.
            await syncCollapsedHistory(driver, markSelfInduced, index, () => {
              driver.replaceState(
                { id, index: 0, status: "REPLACING", params, transitionName, layoutId },
                pathname
              );
            });
          }

          return async () => {
            // Remove the leaving top, read live so it's correct after the
            // intermediate drop and the new entry shifted the index.
            replaceHistory(stores.history.getState().index - 1);
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

  // Shared engine for pop. `resolveSteps` runs inside the task (with the live
  // history) and returns how many screens to pop. A result <= 0 is a no-op
  // (e.g. an unmatched `until`, or a non-positive `count`). Whatever the count,
  // the skipped screens are removed synchronously in the same block that flips
  // to POPPING (before the browser paints), so they never appear; the leaving
  // top stays mounted to drive and resolve the animation.
  const runPop = async (
    resolveSteps: (index: number, histories: History[]) => number,
    transitionName?: TransitionName
  ) => {
    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async (abortController) => {
          const { index, histories, popHistory, popHistories, setTransitionName } =
            stores.history.getState();

          // Nothing below the root to pop. A no-op without touching the browser.
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

          const { setStatus, setTransitionTaskId } = stores.navigate.getState();

          // Relabel the leaving top's transition before the POPPING flip, in the
          // same synchronous block, so the first painted POPPING frame already
          // uses it and the screen's original transition never shows. `index` is
          // the current top (the leaving screen); popHistories keeps that same
          // entry below, so the override survives the intermediate drop.
          if (transitionName) {
            setTransitionName(index, transitionName);
          }

          setStatus("POPPING");
          setTransitionTaskId(id);

          // Drop the n-1 skipped screens synchronously (same block as
          // setStatus, before the browser can paint) so they never appear.
          // The leaving top stays mounted; the destination becomes the visible
          // previous and the transition reduces to a normal 1-step pop.
          // popHistories(0) is a no-op, so steps === 1 takes the exact same
          // path the single-step pop always has.
          popHistories(steps - 1);

          // flemo drives the browser; its own popstate is filtered by the history sync.
          markSelfInduced();
          if (steps === 1) {
            driver.back();
          } else {
            driver.go(-steps);
          }

          return async () => {
            // Remove the leaving top, read live so it's correct after the
            // intermediate drop shifted the index.
            popHistory(stores.history.getState().index);
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
  // route pattern (which stays: pop lands on it). Omitted → one screen. An
  // unmatched `until` or non-positive `skip` is a no-op. `transitionName`
  // overrides the back animation. Handy when collapsing several screens whose
  // own (top) transition isn't the one you want to play.
  const pop = async (options?: PopOptions) => {
    await runPop((index, histories) => {
      if (options?.until != null) {
        const distance = matchDistance(options.until, index, histories);
        return distance < 0 ? 0 : distance;
      }
      const skip = toSkip(options?.skip, 1);
      return skip <= 0 ? 0 : Math.min(skip, index);
    }, options?.transitionName);
  };

  return { push, replace, pop };
}

import { compile, parse } from "path-to-regexp";

import TaskManager from "@core/TaskManger";

import useHistoryStore from "@history/store";

import useNavigationStore from "@navigate/store";
import useTransitionStore from "@transition/store";

import type { RegisterRoute } from "@Route";
import type { TransitionName } from "@transition/typing";

export default function useNavigate() {
  const push = async <T extends keyof RegisterRoute>(
    path: T,
    params: RegisterRoute[T],
    options: {
      transitionName?: TransitionName;
    } = {}
  ) => {
    const { status, setStatus } = useNavigationStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const { index, addHistory } = useHistoryStore.getState();

    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;

    const { transitionName = defaultTransitionName } = options;

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          setStatus("PUSHING");

          const toPathname = compile(path)(params as object);
          const usedParamKeys = parse(path)
            .tokens.filter((token) => token.type === "param")
            .map((token) => token.name);
          const remainingParams = Object.fromEntries(
            Object.entries(params).filter(([key]) => !usedParamKeys.includes(key))
          );
          const search = new URLSearchParams(remainingParams as Record<string, string>).toString();
          const pathname = `${toPathname}${search ? `?${search}` : ""}`;

          if (!window.history.state?.id) {
            window.history.replaceState(
              {
                id: "root",
                index: 0,
                status: "IDLE",
                params: {},
                transitionName
              },
              "",
              window.location.pathname
            );
          }

          window.history.pushState(
            {
              id,
              index: index + 1,
              status: "PUSHING",
              params,
              transitionName
            },
            "",
            pathname
          );

          addHistory({
            id,
            pathname: toPathname,
            params,
            transitionName
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
    params: RegisterRoute[T],
    options: {
      transitionName?: TransitionName;
    } = {}
  ) => {
    const { status, setStatus } = useNavigationStore.getState();

    if (status !== "COMPLETED" && status !== "IDLE") {
      return;
    }

    const { index, addHistory } = useHistoryStore.getState();
    const replaceHistory = useHistoryStore.getState().replaceHistory;
    const defaultTransitionName = useTransitionStore.getState().defaultTransitionName;

    const { transitionName = defaultTransitionName } = options;

    const id = TaskManager.generateTaskId();

    (
      await TaskManager.addTask(
        async () => {
          setStatus("REPLACING");

          const toPathname = compile(path)(params as object);
          const usedParamKeys = parse(path)
            .tokens.filter((token) => token.type === "param")
            .map((token) => token.name);
          const remainingParams = Object.fromEntries(
            Object.entries(params).filter(([key]) => !usedParamKeys.includes(key))
          );
          const search = new URLSearchParams(remainingParams as Record<string, string>).toString();
          const pathname = `${toPathname}${search ? `?${search}` : ""}`;

          window.history.replaceState(
            {
              id,
              index,
              status: "REPLACING",
              params,
              transitionName
            },
            "",
            pathname
          );

          addHistory({
            id,
            pathname: toPathname,
            params,
            transitionName
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

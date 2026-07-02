import { describe, expect, it } from "vitest";

import TaskManager from "@core/TaskManger";

describe("TaskManger conditional control", () => {
  it("parks a task whose condition is not yet met, then resolveAllPending releases it", async () => {
    let conditionMet = false;
    const order: string[] = [];

    const pending = (async () => {
      const { result } = await TaskManager.addTask(
        async () => {
          order.push("ran");
          return async () => order.push("completed");
        },
        { control: { condition: async () => conditionMet } }
      );
      await result?.();
    })();

    // Let the task run up to its condition gate.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(order).toEqual(["ran"]);

    conditionMet = true;
    await TaskManager.resolveAllPending();
    await pending;

    expect(order).toEqual(["ran", "completed"]);
  });

  it("passes straight through when the condition is already met", async () => {
    const order: string[] = [];
    const { result } = await TaskManager.addTask(
      async () => {
        order.push("ran");
        return async () => order.push("completed");
      },
      { control: { condition: async () => true } }
    );
    await result?.();

    expect(order).toEqual(["ran", "completed"]);
  });
});

import { describe, expect, it, vi } from "vitest";

import TaskManger from "@core/TaskManger";

// The TaskManager is exported as a process-wide singleton. Each test below
// awaits its own addTask promise(s) and uses fresh execute fns, so state
// doesn't leak between tests despite the shared instance.

describe("TaskManger: basic execution", () => {
  it("runs execute and resolves with success + result", async () => {
    const execute = vi.fn(async () => "ok");
    const outcome = await TaskManger.addTask(execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("ok");
    expect(outcome.taskId).toBeTypeOf("string");
  });

  it("respects a caller-provided task id", async () => {
    const id = `test-${Math.random().toString(36).slice(2)}`;
    const outcome = await TaskManger.addTask(async () => 1, { id });
    expect(outcome.taskId).toBe(id);
  });

  it("waits options.delay before executing", async () => {
    const start = Date.now();
    await TaskManger.addTask(async () => "delayed", { delay: 80 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(70);
  });
});

describe("TaskManger: FIFO ordering", () => {
  it("processes sequentially in arrival order", async () => {
    const log: number[] = [];
    const p1 = TaskManger.addTask(async () => {
      await new Promise((r) => setTimeout(r, 20));
      log.push(1);
    });
    const p2 = TaskManger.addTask(async () => {
      log.push(2);
    });
    const p3 = TaskManger.addTask(async () => {
      log.push(3);
    });

    await Promise.all([p1, p2, p3]);
    expect(log).toEqual([1, 2, 3]);
  });
});

describe("TaskManger: manual control", () => {
  it("stays MANUAL_PENDING until resolveTask is called", async () => {
    let pendingResolved = false;
    const id = `manual-${Math.random().toString(36).slice(2)}`;

    const pending = TaskManger.addTask(async () => "produced", {
      id,
      control: { manual: true }
    }).then((outcome) => {
      pendingResolved = true;
      return outcome;
    });

    // Give the manager a tick to enter MANUAL_PENDING.
    await new Promise((r) => setTimeout(r, 30));
    expect(pendingResolved).toBe(false);

    const accepted = await TaskManger.resolveTask(id);
    expect(accepted).toBe(true);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("produced");
  });

  it("resolveTask returns false for unknown task ids", async () => {
    expect(await TaskManger.resolveTask("does-not-exist")).toBe(false);
  });

  it("resolveTask returns false for an already-completed task", async () => {
    const outcome = await TaskManger.addTask(async () => 1);
    expect(await TaskManger.resolveTask(outcome.taskId!)).toBe(false);
  });

  it("control.condition blocks until the condition flips, then resolveTask can clear it", async () => {
    let allowResolve = false;
    const id = `cond-${Math.random().toString(36).slice(2)}`;

    const pending = TaskManger.addTask(async () => "with-cond", {
      id,
      control: {
        manual: true,
        condition: async () => allowResolve
      }
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(await TaskManger.resolveTask(id)).toBe(false);

    allowResolve = true;
    expect(await TaskManger.resolveTask(id)).toBe(true);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("with-cond");
  });
});

describe("TaskManger: signal control", () => {
  it("stays SIGNAL_PENDING until emitSignal fires the matching signal", async () => {
    const id = `sig-${Math.random().toString(36).slice(2)}`;
    const signalName = `signal-${Math.random().toString(36).slice(2)}`;
    let pendingResolved = false;

    const pending = TaskManger.addTask(async () => "via-signal", {
      id,
      control: { signal: signalName }
    }).then((outcome) => {
      pendingResolved = true;
      return outcome;
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(pendingResolved).toBe(false);

    TaskManger.emitSignal(signalName);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("via-signal");
  });

  it("emitSignal on an unknown signal is a no-op", () => {
    expect(() => TaskManger.emitSignal("nothing-listens-here")).not.toThrow();
  });
});

describe("TaskManger: stress", () => {
  // These don't measure performance, they pin invariants under load. The
  // singleton TaskManager has to stay deterministic when callers fan out
  // dozens-to-hundreds of pushes, mix in failures, or interleave manual /
  // signal control. A regression in queue state, lock release, or status
  // bookkeeping will surface here as a deadlock or out-of-order log.

  it("preserves FIFO ordering under 200 concurrent pushes", async () => {
    const N = 200;
    const log: number[] = [];
    const promises = Array.from({ length: N }, (_, i) =>
      TaskManger.addTask(async () => {
        log.push(i);
      })
    );
    await Promise.all(promises);
    expect(log.length).toBe(N);
    expect(log).toEqual(Array.from({ length: N }, (_, i) => i));
  });

  it("isolates failures: every 10th task throws, the other 90 still complete", async () => {
    const N = 100;
    const succeeded: number[] = [];
    const failed: number[] = [];

    const promises = Array.from({ length: N }, (_, i) => {
      if (i % 10 === 9) {
        return TaskManger.addTask(async () => {
          throw new Error(`fail-${i}`);
        }).catch(() => {
          failed.push(i);
        });
      }
      return TaskManger.addTask(async () => {
        succeeded.push(i);
      });
    });

    await Promise.all(promises);
    expect(succeeded.length).toBe(90);
    expect(failed.length).toBe(10);
    expect(failed).toEqual([9, 19, 29, 39, 49, 59, 69, 79, 89, 99]);
  });

  it("manual task at the head blocks 50 followers until resolveTask unblocks", async () => {
    const log: number[] = [];
    const manualId = `stress-manual-${Math.random().toString(36).slice(2)}`;

    const manualPromise = TaskManger.addTask(
      async () => {
        log.push(-1);
        return "m";
      },
      { id: manualId, control: { manual: true } }
    );

    const tail = Array.from({ length: 50 }, (_, i) =>
      TaskManger.addTask(async () => {
        log.push(i);
      })
    );

    // Wait long enough for the head task to enter MANUAL_PENDING and for
    // followers to fall into waitForPendingTasks polling. Followers must
    // not have run yet. The manual is gating the chain.
    await new Promise((r) => setTimeout(r, 50));
    expect(log).toEqual([-1]);

    const resolved = await TaskManger.resolveTask(manualId);
    expect(resolved).toBe(true);

    await manualPromise;
    await Promise.all(tail);

    expect(log).toEqual([-1, ...Array.from({ length: 50 }, (_, i) => i)]);
  });

  it("resolves 15 SIGNAL_PENDING tasks sequenced through their own signals", async () => {
    const N = 15;
    const prefix = `sig-${Math.random().toString(36).slice(2)}`;
    const taskPromises = Array.from({ length: N }, (_, i) =>
      TaskManger.addTask(async () => i, {
        id: `stress-${prefix}-${i}`,
        control: { signal: `${prefix}-${i}` }
      })
    );

    // The chain serializes: only one task is in SIGNAL_PENDING at a time.
    // The rest sit behind waitForPendingTasks (100ms poll). A naive
    // "emit-once with a tight gap" race-leaks emits into empty slots. A
    // background sweeper re-emits every known signal until each task lands
    // in SIGNAL_PENDING and catches its emit.
    let sweeping = true;
    const sweeper = (async () => {
      while (sweeping) {
        for (let i = 0; i < N; i++) {
          TaskManger.emitSignal(`${prefix}-${i}`);
        }
        await new Promise((r) => setTimeout(r, 30));
      }
    })();

    const results = await Promise.all(taskPromises);
    sweeping = false;
    await sweeper;

    expect(results.length).toBe(N);
    results.forEach((r, i) => {
      expect(r.success).toBe(true);
      expect(r.result).toBe(i);
    });
  });

  it("mixed fan-out (immediate + manual + failing) still drains every promise", async () => {
    const settled: string[] = [];
    const promises: Promise<unknown>[] = [];

    // Interleave 60 tasks: every 12th slot 3 is a manual, slot 7 throws, the
    // rest run immediately. Manuals are unblocked by a background sweeper
    // that calls `resolveAllPending` on a tick so the chain stays moving.
    for (let i = 0; i < 60; i++) {
      const kind = i % 12;
      if (kind === 3) {
        promises.push(
          TaskManger.addTask(async () => `m-${i}`, {
            control: { manual: true }
          }).then(() => {
            settled.push(`m-${i}`);
          })
        );
        continue;
      }
      if (kind === 7) {
        promises.push(
          TaskManger.addTask(async () => {
            throw new Error(`fail-${i}`);
          }).catch(() => {
            settled.push(`f-${i}`);
          })
        );
        continue;
      }
      promises.push(
        TaskManger.addTask(async () => i).then(() => {
          settled.push(`i-${i}`);
        })
      );
    }

    let sweeping = true;
    const sweeper = (async () => {
      while (sweeping) {
        await new Promise((r) => setTimeout(r, 15));
        await TaskManger.resolveAllPending();
      }
    })();

    await Promise.all(promises);
    sweeping = false;
    await sweeper;

    expect(settled.length).toBe(60);
  });
});

describe("TaskManger: failure paths", () => {
  it("rejects when execute throws and invokes the rollback hook", async () => {
    const rollback = vi.fn(async () => undefined);
    const failure = TaskManger.addTask(
      async () => {
        throw new Error("boom");
      },
      { rollback }
    );

    await expect(failure).rejects.toThrow("boom");
    expect(rollback).toHaveBeenCalledTimes(1);
  });

  it("rejects when validate() returns false (execute is never called)", async () => {
    const execute = vi.fn(async () => "should-not-run");
    const failure = TaskManger.addTask(execute, {
      validate: async () => false
    });

    await expect(failure).rejects.toThrow("FAILED");
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("TaskManger: abort handling", () => {
  it("aborting the controller during execute still resolves successfully (result is undefined)", async () => {
    const outcome = await TaskManger.addTask(async (controller) => {
      controller.abort();
      return "would-have-been";
    });

    expect(outcome.success).toBe(true);
    expect(outcome.result).toBeUndefined();
  });
});

describe("TaskManger: pre-resolve delay (control.delay)", () => {
  it("waits control.delay milliseconds after execute before resolving", async () => {
    const start = Date.now();
    await TaskManger.addTask(async () => "done", {
      control: { delay: 80 }
    });
    expect(Date.now() - start).toBeGreaterThanOrEqual(70);
  });
});

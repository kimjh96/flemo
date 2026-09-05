import { describe, expect, it, vi } from "vitest";

import TaskManager from "@core/TaskManager";

// The TaskManager is exported as a process-wide singleton. Each test below
// awaits its own addTask promise(s) and uses fresh execute fns, so state
// doesn't leak between tests despite the shared instance.

describe("TaskManager: basic execution", () => {
  it("runs execute and resolves with success + result", async () => {
    const execute = vi.fn(async () => "ok");
    const outcome = await TaskManager.addTask(execute);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("ok");
    expect(outcome.taskId).toBeTypeOf("string");
  });

  it("respects a caller-provided task id", async () => {
    const id = `test-${Math.random().toString(36).slice(2)}`;
    const outcome = await TaskManager.addTask(async () => 1, { id });
    expect(outcome.taskId).toBe(id);
  });

  it("waits options.delay before executing", async () => {
    const start = Date.now();
    await TaskManager.addTask(async () => "delayed", { delay: 80 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(70);
  });
});

describe("TaskManager: FIFO ordering", () => {
  it("processes sequentially in arrival order", async () => {
    const log: number[] = [];
    const p1 = TaskManager.addTask(async () => {
      await new Promise((r) => setTimeout(r, 20));
      log.push(1);
    });
    const p2 = TaskManager.addTask(async () => {
      log.push(2);
    });
    const p3 = TaskManager.addTask(async () => {
      log.push(3);
    });

    await Promise.all([p1, p2, p3]);
    expect(log).toEqual([1, 2, 3]);
  });
});

describe("TaskManager: manual control", () => {
  it("stays MANUAL_PENDING until resolveTask is called", async () => {
    let pendingResolved = false;
    const id = `manual-${Math.random().toString(36).slice(2)}`;

    const pending = TaskManager.addTask(async () => "produced", {
      id,
      control: { manual: true }
    }).then((outcome) => {
      pendingResolved = true;
      return outcome;
    });

    // Give the manager a tick to enter MANUAL_PENDING.
    await new Promise((r) => setTimeout(r, 30));
    expect(pendingResolved).toBe(false);

    const accepted = await TaskManager.resolveTask(id);
    expect(accepted).toBe(true);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("produced");
  });

  it("resolveTask returns false for unknown task ids", async () => {
    expect(await TaskManager.resolveTask("does-not-exist")).toBe(false);
  });

  it("resolveTask returns false for an already-completed task", async () => {
    const outcome = await TaskManager.addTask(async () => 1);
    expect(await TaskManager.resolveTask(outcome.taskId!)).toBe(false);
  });

  it("control.condition blocks until the condition flips, then resolveTask can clear it", async () => {
    let allowResolve = false;
    const id = `cond-${Math.random().toString(36).slice(2)}`;

    const pending = TaskManager.addTask(async () => "with-cond", {
      id,
      control: {
        manual: true,
        condition: async () => allowResolve
      }
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(await TaskManager.resolveTask(id)).toBe(false);

    allowResolve = true;
    expect(await TaskManager.resolveTask(id)).toBe(true);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("with-cond");
  });
});

describe("TaskManager: condition control (non-manual)", () => {
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

describe("TaskManager: signal control", () => {
  it("stays SIGNAL_PENDING until emitSignal fires the matching signal", async () => {
    const id = `sig-${Math.random().toString(36).slice(2)}`;
    const signalName = `signal-${Math.random().toString(36).slice(2)}`;
    let pendingResolved = false;

    const pending = TaskManager.addTask(async () => "via-signal", {
      id,
      control: { signal: signalName }
    }).then((outcome) => {
      pendingResolved = true;
      return outcome;
    });

    await new Promise((r) => setTimeout(r, 30));
    expect(pendingResolved).toBe(false);

    TaskManager.emitSignal(signalName);

    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("via-signal");
  });

  it("emitSignal on an unknown signal is a no-op", () => {
    expect(() => TaskManager.emitSignal("nothing-listens-here")).not.toThrow();
  });
});

describe("TaskManager: stress", () => {
  // These don't measure performance, they pin invariants under load. The
  // singleton TaskManager has to stay deterministic when callers fan out
  // dozens-to-hundreds of pushes, mix in failures, or interleave manual /
  // signal control. A regression in queue state, lock release, or status
  // bookkeeping will surface here as a deadlock or out-of-order log.

  it("preserves FIFO ordering under 200 concurrent pushes", async () => {
    const N = 200;
    const log: number[] = [];
    const promises = Array.from({ length: N }, (_, i) =>
      TaskManager.addTask(async () => {
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
        return TaskManager.addTask(async () => {
          throw new Error(`fail-${i}`);
        }).catch(() => {
          failed.push(i);
        });
      }
      return TaskManager.addTask(async () => {
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

    const manualPromise = TaskManager.addTask(
      async () => {
        log.push(-1);
        return "m";
      },
      { id: manualId, control: { manual: true } }
    );

    const tail = Array.from({ length: 50 }, (_, i) =>
      TaskManager.addTask(async () => {
        log.push(i);
      })
    );

    // Wait long enough for the head task to enter MANUAL_PENDING and for
    // followers to fall into waitForPendingTasks polling. Followers must
    // not have run yet. The manual is gating the chain.
    await new Promise((r) => setTimeout(r, 50));
    expect(log).toEqual([-1]);

    const resolved = await TaskManager.resolveTask(manualId);
    expect(resolved).toBe(true);

    await manualPromise;
    await Promise.all(tail);

    expect(log).toEqual([-1, ...Array.from({ length: 50 }, (_, i) => i)]);
  });

  it("resolves 15 SIGNAL_PENDING tasks sequenced through their own signals", async () => {
    const N = 15;
    const prefix = `sig-${Math.random().toString(36).slice(2)}`;
    const taskPromises = Array.from({ length: N }, (_, i) =>
      TaskManager.addTask(async () => i, {
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
          TaskManager.emitSignal(`${prefix}-${i}`);
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
          TaskManager.addTask(async () => `m-${i}`, {
            control: { manual: true }
          }).then(() => {
            settled.push(`m-${i}`);
          })
        );
        continue;
      }
      if (kind === 7) {
        promises.push(
          TaskManager.addTask(async () => {
            throw new Error(`fail-${i}`);
          }).catch(() => {
            settled.push(`f-${i}`);
          })
        );
        continue;
      }
      promises.push(
        TaskManager.addTask(async () => i).then(() => {
          settled.push(`i-${i}`);
        })
      );
    }

    let sweeping = true;
    const sweeper = (async () => {
      while (sweeping) {
        await new Promise((r) => setTimeout(r, 15));
        await TaskManager.resolveAllPending();
      }
    })();

    await Promise.all(promises);
    sweeping = false;
    await sweeper;

    expect(settled.length).toBe(60);
  });
});

describe("TaskManager: failure paths", () => {
  it("rejects when execute throws and invokes the rollback hook", async () => {
    const rollback = vi.fn(async () => undefined);
    const failure = TaskManager.addTask(
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
    const failure = TaskManager.addTask(execute, {
      validate: async () => false
    });

    await expect(failure).rejects.toThrow("FAILED");
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("TaskManager: abort handling", () => {
  it("aborting the controller during execute still resolves successfully (result is undefined)", async () => {
    const outcome = await TaskManager.addTask(async (controller) => {
      controller.abort();
      return "would-have-been";
    });

    expect(outcome.success).toBe(true);
    expect(outcome.result).toBeUndefined();
  });
});

describe("TaskManager: pre-resolve delay (control.delay)", () => {
  it("waits control.delay milliseconds after execute before resolving", async () => {
    const start = Date.now();
    await TaskManager.addTask(async () => "done", {
      control: { delay: 80 }
    });
    expect(Date.now() - start).toBeGreaterThanOrEqual(70);
  });
});

describe("TaskManager: gate backstop (control.maxLifetimeMs)", () => {
  it("force-resolves a parked manual task whose resolve signal never arrives", async () => {
    const start = Date.now();
    // Nobody calls resolveTask — the lost-animationend scenario. Without the
    // backstop this await would hang forever and deadlock the serial queue.
    const outcome = await TaskManager.addTask(async () => "gated", {
      control: { manual: true, maxLifetimeMs: 120 }
    });

    expect(outcome.success).toBe(true);
    expect(outcome.result).toBe("gated");
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  });

  it("a normal resolve clears the backstop (no double resolution afterwards)", async () => {
    const id = TaskManager.generateTaskId();
    const pending = TaskManager.addTask(async () => "gated", {
      id,
      control: { manual: true, maxLifetimeMs: 150 }
    });
    // Resolve promptly, then wait past the lifetime: the timer must be gone.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await TaskManager.resolveTask(id);
    const outcome = await pending;
    expect(outcome.result).toBe("gated");

    await new Promise((resolve) => setTimeout(resolve, 200));
    // A second (backstop) resolution attempt on a completed task is a no-op.
    expect(await TaskManager.resolveTask(id)).toBe(false);
  });
});

describe("TaskManager: gate phases (markGateHeld / anchorGate)", () => {
  it("a HELD gate re-arms past its window instead of force-resolving", async () => {
    const id = TaskManager.generateTaskId();
    const resolvedAt: number[] = [];
    const start = Date.now();
    const pending = TaskManager.addTask(async () => "held", {
      id,
      control: { manual: true, maxLifetimeMs: 80 }
    });
    // The engine saw a hold whose motion has not started (a long entering
    // commit is still blocking). The 80ms backstop must NOT snap the task.
    TaskManager.markGateHeld(id);

    await new Promise((resolve) => setTimeout(resolve, 120));
    // Past the first window: still parked (re-armed, not force-resolved).
    void pending.then(() => resolvedAt.push(Date.now() - start));
    expect(resolvedAt).toEqual([]);

    // The hold releases — motion starts on a FRESH window, then resolves
    // normally (animationend in production; explicit here).
    TaskManager.anchorGate(id);
    await TaskManager.resolveTask(id);
    const outcome = await pending;
    expect(outcome.result).toBe("held");
  });

  it("a held gate that never anchors still force-resolves at the re-arm bound", async () => {
    const id = TaskManager.generateTaskId();
    const start = Date.now();
    const pending = TaskManager.addTask(async () => "wedged", {
      id,
      control: { manual: true, maxLifetimeMs: 60 }
    });
    TaskManager.markGateHeld(id);

    // Nobody ever anchors or resolves (zone torn down while held). The bound
    // (1 + MAX_HELD_GATE_REARMS windows) must still free the serial queue.
    const outcome = await pending;
    expect(outcome.success).toBe(true);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(150);
    expect(elapsed).toBeLessThan(1000);
  });

  it("anchoring restarts the gate with a full window from the motion start", async () => {
    const id = TaskManager.generateTaskId();
    const events: string[] = [];
    const pending = TaskManager.addTask(async () => "anchored", {
      id,
      control: { manual: true, maxLifetimeMs: 100 }
    });
    TaskManager.markGateHeld(id);
    // Release lands 70ms after the park: the original window had 30ms left,
    // but the anchor must grant a fresh 100ms from HERE.
    await new Promise((resolve) => setTimeout(resolve, 70));
    TaskManager.anchorGate(id);
    void pending.then(() => events.push("resolved"));

    await new Promise((resolve) => setTimeout(resolve, 60));
    // 130ms after park (past the original window) but only 60ms after the
    // anchor: still parked.
    expect(events).toEqual([]);

    // The re-anchored backstop is still the lost-gate net: with no
    // animationend ever arriving it fires at the anchor + lifetime.
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(events).toEqual(["resolved"]);
  });

  it("an anchored motion span extends the gate past the configured default", async () => {
    const id = TaskManager.generateTaskId();
    const events: string[] = [];
    const pending = TaskManager.addTask(async () => "long-motion", {
      id,
      control: { manual: true, maxLifetimeMs: 80 }
    });
    TaskManager.markGateHeld(id);
    // A 3s-authored motion anchors with its own span: the 80ms default must
    // not cut it — the gate default assumed no transition outlives it and
    // silently snapped longer authored motions to rest.
    TaskManager.anchorGate(id, 250);
    void pending.then(() => events.push("resolved"));

    await new Promise((resolve) => setTimeout(resolve, 150));
    // Past the configured default, inside the motion span: still flying.
    expect(events).toEqual([]);

    // Past the anchored span the gate is still the stranded-task net.
    await new Promise((resolve) => setTimeout(resolve, 180));
    expect(events).toEqual(["resolved"]);
  });

  it("anchorGate is idempotent: repeated anchors cannot extend the gate", async () => {
    const id = TaskManager.generateTaskId();
    const pending = TaskManager.addTask(async () => "once", {
      id,
      control: { manual: true, maxLifetimeMs: 80 }
    });
    TaskManager.anchorGate(id);
    const start = Date.now();
    // Spam anchors while the window runs down — none may restart it.
    const spam = setInterval(() => TaskManager.anchorGate(id), 20);
    const outcome = await pending;
    clearInterval(spam);
    expect(outcome.success).toBe(true);
    expect(Date.now() - start).toBeLessThan(400);
  });

  it("markGateHeld never downgrades an anchored gate", async () => {
    const id = TaskManager.generateTaskId();
    const pending = TaskManager.addTask(async () => "no-downgrade", {
      id,
      control: { manual: true, maxLifetimeMs: 60 }
    });
    TaskManager.anchorGate(id);
    TaskManager.markGateHeld(id);
    // Anchored stays anchored: the backstop fires at the (single) fresh
    // window instead of deferring as held.
    const start = Date.now();
    const outcome = await pending;
    expect(outcome.success).toBe(true);
    expect(Date.now() - start).toBeLessThan(300);
  });

  it("a settled task's phase is pruned: a reused id starts unreported", async () => {
    const id = TaskManager.generateTaskId();
    const first = TaskManager.addTask(async () => "first", {
      id,
      control: { manual: true, maxLifetimeMs: 60 }
    });
    TaskManager.markGateHeld(id);
    TaskManager.anchorGate(id);
    await TaskManager.resolveTask(id);
    await first;

    // Phase reports for ids without a live task are kept (a report may land
    // before the park) — but a SETTLED task's phase must be gone, so this
    // fresh park force-resolves on its first window like any unreported gate.
    const start = Date.now();
    const second = await TaskManager.addTask(async () => "second", {
      id: `${id}-next`,
      control: { manual: true, maxLifetimeMs: 60 }
    });
    expect(second.success).toBe(true);
    expect(Date.now() - start).toBeLessThan(250);
  });
});

// ONE FRAME BETWEEN A FLIGHT'S TEARDOWN AND THE NEXT FLIGHT'S OPENING.
//
// The queue used to wake synchronously with a terminal flip, which put both
// state changes in ONE binding commit: the finished flight's screen unmounted
// and the queued flight's opening stamped together, so a single frame carried
// two flights' worth of style, layout and paint.
//
// Reproduced by driving two system-back gestures 60ms apart against a
// production build under a 6x CPU throttle: a dropped frame of 31-37ms in every
// run, at the exact millisecond the screen count fell, and none in the
// single-back control. No long task — not one script doing too much, one frame
// asked to commit two flights. Device-reported on a Galaxy Z Flip 4 as a single
// hitch on a fast double back. After the split: 22-28ms, and not every run.
describe("TaskManager: the queue hands over on a frame boundary", () => {
  /**
   * A queued task only goes through the WAKE path when something is genuinely
   * pending ahead of it — a waiter added to an empty queue resolves on the spot
   * and never reaches the notify at all. So the fixture holds a manual task
   * open, queues behind it, and then lets it finish.
   */
  const queueBehindAPendingTask = () => {
    const id = `frame-${Math.random().toString(36).slice(2)}`;
    const order: string[] = [];
    const held = TaskManager.addTask(
      async () => {
        order.push("held");
        return "held";
      },
      { id, control: { manual: true } }
    );
    const queued = TaskManager.addTask(async () => {
      order.push("queued");
      return "queued";
    });
    return { id, order, held, queued };
  };

  it("wakes the queued task on a FRAME, not inside the terminal flip", async () => {
    const frames: (() => void)[] = [];
    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation((cb: FrameRequestCallback) => {
        frames.push(() => cb(0));
        return frames.length;
      });

    try {
      const { id, order, held, queued } = queueBehindAPendingTask();
      await new Promise((r) => setTimeout(r, 30));

      await TaskManager.resolveTask(id);
      await held;
      await new Promise((r) => setTimeout(r, 30));

      // The terminal flip has landed and the queued task has NOT run: the
      // binding needs this frame to commit the finished flight's teardown
      // alone. Running both in one commit is the dropped frame this exists to
      // stop.
      expect(order).toEqual(["held"]);
      expect(frames.length).toBeGreaterThan(0);

      for (const run of frames.splice(0)) run();
      await queued;
      expect(order).toEqual(["held", "queued"]);
    } finally {
      raf.mockRestore();
    }
  });

  it("hands over immediately where there is no frame clock", async () => {
    const saved = globalThis.requestAnimationFrame;
    // SSR, or a non-browser embedder: nothing commits, so there is nothing to
    // separate — and the queue must not limp along on the 100ms poll that backs
    // the waiter up.
    Object.defineProperty(globalThis, "requestAnimationFrame", {
      value: undefined,
      configurable: true
    });
    try {
      const { id, order, held, queued } = queueBehindAPendingTask();
      await new Promise((r) => setTimeout(r, 30));

      const started = Date.now();
      await TaskManager.resolveTask(id);
      await Promise.all([held, queued]);

      expect(order).toEqual(["held", "queued"]);
      expect(Date.now() - started).toBeLessThan(80);
    } finally {
      Object.defineProperty(globalThis, "requestAnimationFrame", {
        value: saved,
        configurable: true
      });
    }
  });
});

// ONE SERIAL LANE PER HISTORY, NOT ONE PER PAGE.
//
// Navigations take turns because `window.history` is singular. A Router with
// its own stack (history="memory") shares none of that, and used to queue
// behind every other Router on the page anyway: on the marketing site, whose
// landing runs two looping memory mockups, the real call to action started its
// flight in 58-67ms while they were idle and in 246-868ms while one was
// mid-flight. These tests pin that a lane still serializes itself and no longer
// serializes against anyone else.
describe("TaskManager: serial lanes", () => {
  // A task that parks its gate open until the test resolves it, which is the
  // shape a transition-gated navigation takes.
  const parked = (id: string, scope?: string) =>
    TaskManager.addTask(async () => id, { id, scope, control: { manual: true } });

  it("still serializes two tasks in the same lane", async () => {
    const order: string[] = [];
    const first = TaskManager.addTask(
      async () => {
        order.push("first-start");
        await new Promise((resolve) => setTimeout(resolve, 40));
        order.push("first-end");
      },
      { scope: "lane-a" }
    );
    const second = TaskManager.addTask(
      async () => {
        order.push("second-start");
      },
      { scope: "lane-a" }
    );

    await Promise.all([first, second]);

    expect(order).toEqual(["first-start", "first-end", "second-start"]);
  });

  it("does not make one lane wait on another lane's open gate", async () => {
    // A parked gate in one lane: its own lane is blocked for as long as it
    // stays open. This is the looping mockup.
    const blocking = parked("lane-b-parked", "lane-b");

    // The other lane must run to completion regardless.
    const free = await TaskManager.addTask(async () => "ran", { scope: "lane-c" });
    expect(free.success).toBe(true);
    expect(free.result).toBe("ran");

    await TaskManager.resolveTask("lane-b-parked");
    await blocking;
  });

  it("keeps the browser lane shared by every caller that names no lane", async () => {
    const blocking = parked("browser-parked");
    const order: string[] = [];

    const queued = TaskManager.addTask(async () => {
      order.push("queued");
    });

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(order).toEqual([]); // still behind the open gate, as it always was

    await TaskManager.resolveTask("browser-parked");
    await blocking;
    await queued;
    expect(order).toEqual(["queued"]);
  });
});

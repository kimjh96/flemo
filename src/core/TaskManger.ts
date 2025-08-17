interface TaskResult<T> {
  success: boolean;
  error?: Error;
  result?: T;
  taskId?: string;
  timestamp?: number;
  instanceId?: string;
}

type TaskStatus =
  | "PENDING"
  | "MANUAL_PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "ROLLEDBACK";

interface Control {
  manual?: boolean; // 수동 resolve 제어
  delay?: number; // 지연 시간 (ms)
  condition?: () => Promise<boolean>; // 조건부 resolve
  signal?: string; // 특정 신호 대기
}

interface Task<T> {
  id: string;
  execute: () => Promise<T>;
  validate?: () => Promise<boolean>;
  rollback?: () => Promise<void>;
  control?: Control;
  timestamp: number;
  retryCount: number;
  status: TaskStatus;
  dependencies: string[];
  instanceId: string;
  manualResolver?: {
    resolve: (value: TaskResult<T>) => void;
    reject: (error: Error) => void;
    result: T;
  };
}

class TaskManager {
  private tasks: Map<string, Task<unknown>> = new Map();
  private readonly instanceId = Date.now().toString();
  private isLocked: boolean = false;
  private currentTaskId: string | null = null;
  private taskQueue: Promise<void> = Promise.resolve();
  private signalListeners: Map<string, Set<string>> = new Map(); // 신호 리스너

  private async acquireLock(taskId: string) {
    const maxRetries = 10;
    const retryDelay = 100;

    for (let i = 0; i < maxRetries; i++) {
      if (!this.isLocked) {
        this.isLocked = true;
        this.currentTaskId = taskId;
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
    return false;
  }

  private releaseLock(taskId: string): void {
    if (this.currentTaskId === taskId) {
      this.isLocked = false;
      this.currentTaskId = null;
    }
  }

  public generateTaskId() {
    return `${this.instanceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public emitSignal(signalName: string) {
    const taskIds = this.signalListeners.get(signalName);
    if (taskIds) {
      taskIds.forEach((taskId) => {
        this.resolveTask(taskId);
      });
      this.signalListeners.delete(signalName);
    }
  }

  public async addTask<T>(
    execute: () => Promise<T>,
    options: {
      id?: string;
      validate?: () => Promise<boolean>;
      rollback?: () => Promise<void>;
      dependencies?: string[];
      control?: Control;
    } = {}
  ): Promise<TaskResult<T>> {
    const id = options.id || this.generateTaskId();

    return new Promise((resolve, reject) => {
      this.taskQueue = this.taskQueue
        .then(async () => {
          try {
            const { control, validate, rollback, dependencies = [] } = options;

            const task: Task<T> = {
              id,
              execute,
              timestamp: Date.now(),
              retryCount: 0,
              status: "PENDING",
              dependencies,
              instanceId: this.instanceId,
              validate,
              rollback,
              control
            };

            this.tasks.set(task.id, task as Task<unknown>);

            try {
              const lockAcquired = await this.acquireLock(task.id);
              if (!lockAcquired) {
                task.status = "FAILED";
                // TODO: 작업 락 획득 실패 시 처리
                throw new Error(`FAILED`);
              }

              try {
                task.status = "PROCESSING";

                for (const depId of task.dependencies) {
                  const depTask = this.tasks.get(depId);
                  if (!depTask || depTask.status !== "COMPLETED") {
                    task.status = "FAILED";
                    // TODO: 의존성 작업 실패 시 처리
                    throw new Error(`FAILED`);
                  }
                }

                if (task.validate) {
                  const isValid = await task.validate();
                  if (!isValid) {
                    task.status = "FAILED";
                    // TODO: 검증 실패 시 처리
                    throw new Error("FAILED");
                  }
                }

                const result = await task.execute();

                // resolve 제어 로직
                if (options.control) {
                  const control = options.control;

                  // 지연 시간이 있는 경우
                  if (control.delay && control.delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, control.delay));
                  }

                  // 수동 resolve 제어
                  if (control.manual) {
                    task.status = "MANUAL_PENDING";
                    task.manualResolver = { resolve, reject, result };
                    return; // 여기서 함수 종료, resolve는 나중에 수동으로 호출
                  }

                  // 신호 대기
                  if (control.signal) {
                    task.status = "MANUAL_PENDING";
                    task.manualResolver = { resolve, reject, result };

                    // 신호 리스너 등록
                    if (!this.signalListeners.has(control.signal)) {
                      this.signalListeners.set(control.signal, new Set());
                    }
                    this.signalListeners.get(control.signal)!.add(task.id);
                    return;
                  }

                  // 조건부 resolve 제어
                  if (control.condition) {
                    const conditionMet = await control.condition();
                    if (!conditionMet) {
                      task.status = "MANUAL_PENDING";
                      task.manualResolver = { resolve, reject, result };
                      return;
                    }
                  }
                }

                task.status = "COMPLETED";

                resolve({
                  success: true,
                  result,
                  taskId: task.id,
                  timestamp: Date.now(),
                  instanceId: this.instanceId
                });
              } catch (error) {
                task.status = "FAILED";

                if (task.rollback) {
                  try {
                    await task.rollback();
                    task.status = "ROLLEDBACK";
                  } catch {
                    // TODO: 롤백 실패 시 처리
                  }
                }
                throw error;
              } finally {
                this.releaseLock(task.id);
              }
            } catch (error) {
              reject(error);
            }
          } catch (error) {
            reject(error);
          }
        })
        .catch(reject);
    });
  }

  public async resolveTask(taskId: string) {
    const task = this.tasks.get(taskId);

    if (!task || task.status !== "MANUAL_PENDING") {
      return false;
    }

    if (task.manualResolver) {
      // 조건부 resolve 확인
      if (task.control?.condition) {
        const conditionMet = await task.control.condition();
        if (!conditionMet) {
          return false;
        }
      }

      task.status = "COMPLETED";
      const manualResolver = task.manualResolver as {
        resolve: (value: TaskResult<unknown>) => void;
        reject: (error: Error) => void;
        result: unknown;
      };

      manualResolver.resolve({
        success: true,
        result: manualResolver.result,
        taskId: task.id,
        timestamp: Date.now(),
        instanceId: this.instanceId
      });

      delete task.manualResolver;

      return true;
    }

    return false;
  }

  public async resolveAllPending() {
    const pendingTasks = Array.from(this.tasks.values()).filter((task) =>
      ["PENDING", "MANUAL_PENDING"].includes(task.status)
    );

    await Promise.all(pendingTasks.map((task) => this.resolveTask(task.id)));
  }

  public getManualPendingTasks() {
    return Array.from(this.tasks.values()).filter((task) => task.status === "MANUAL_PENDING");
  }
}

const instance = new TaskManager();

export default instance;

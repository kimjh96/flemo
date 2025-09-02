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
  | "SIGNAL_PENDING"
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
  execute: (abortController: AbortController) => Promise<T>;
  validate?: () => Promise<boolean>;
  rollback?: () => Promise<void>;
  control?: Control;
  timestamp: number;
  retryCount: number;
  status: TaskStatus;
  dependencies: string[];
  instanceId: string;
  abortController?: AbortController;
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
  private signalListeners: Map<string, Set<string>> = new Map();
  private pendingTaskQueue: Task<unknown>[] = [];
  private isProcessingPending: boolean = false;

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

  // 대기 중인 태스크들을 처리하는 메서드
  private async processPendingTasks() {
    if (this.isProcessingPending || this.pendingTaskQueue.length === 0) {
      return;
    }

    this.isProcessingPending = true;

    try {
      while (this.pendingTaskQueue.length > 0) {
        const task = this.pendingTaskQueue[0]; // 첫 번째 태스크만 확인 (FIFO)

        // 태스크가 완료되었는지 확인
        if (
          task.status === "COMPLETED" ||
          task.status === "FAILED" ||
          task.status === "ROLLEDBACK"
        ) {
          this.pendingTaskQueue.shift(); // 완료된 태스크 제거
          continue;
        }

        // 태스크가 아직 대기 중인 상태라면 더 이상 진행하지 않음
        if (task.status === "MANUAL_PENDING" || task.status === "SIGNAL_PENDING") {
          break;
        }

        // 태스크가 처리 중이거나 완료 대기 중이라면 다음 태스크로
        if (task.status === "PROCESSING" || task.status === "PENDING") {
          break;
        }
      }
    } finally {
      this.isProcessingPending = false;
    }
  }

  // 모든 대기 중인 태스크가 완료될 때까지 대기
  private async waitForPendingTasks(): Promise<void> {
    return new Promise((resolve) => {
      const checkPendingTasks = () => {
        const pendingTasks = this.pendingTaskQueue.filter(
          (task) => task.status === "MANUAL_PENDING" || task.status === "SIGNAL_PENDING"
        );

        if (pendingTasks.length === 0) {
          resolve();
        } else {
          setTimeout(checkPendingTasks, 100);
        }
      };

      checkPendingTasks();
    });
  }

  // 태스크 상태 변경 시 대기 큐 처리
  private async onTaskStatusChange(taskId: string, newStatus: TaskStatus) {
    if (newStatus === "COMPLETED" || newStatus === "FAILED" || newStatus === "ROLLEDBACK") {
      // 완료된 태스크가 대기 큐에 있다면 제거
      this.pendingTaskQueue = this.pendingTaskQueue.filter((task) => task.id !== taskId);

      // 대기 큐 처리 재시작
      await this.processPendingTasks();
    }
  }

  public async addTask<T>(
    execute: Task<T>["execute"],
    options: {
      id?: string;
      delay?: number;
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
            const { control, validate, rollback, dependencies = [], delay } = options;
            const abortController = new AbortController();

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
              control,
              abortController
            };

            this.tasks.set(task.id, task as Task<unknown>);

            // 대기 중인 태스크가 있는지 확인하고 대기
            const hasPendingTasks = this.pendingTaskQueue.length > 0;

            if (hasPendingTasks) {
              // 대기 큐에 추가하고 모든 대기 중인 태스크가 완료될 때까지 대기
              this.pendingTaskQueue.push(task as Task<unknown>);
              await this.waitForPendingTasks();

              // 대기 큐에서 제거
              this.pendingTaskQueue = this.pendingTaskQueue.filter((t) => t.id !== task.id);
            }

            try {
              const lockAcquired = await this.acquireLock(task.id);
              if (!lockAcquired) {
                task.status = "FAILED";
                throw new Error(`FAILED`);
              }

              try {
                task.status = "PROCESSING";

                // 의존성 확인
                for (const depId of task.dependencies) {
                  const depTask = this.tasks.get(depId);
                  if (!depTask || depTask.status !== "COMPLETED") {
                    task.status = "FAILED";
                    throw new Error(`FAILED`);
                  }
                }

                // 검증
                if (task.validate) {
                  const isValid = await task.validate();
                  if (!isValid) {
                    task.status = "FAILED";
                    throw new Error(`FAILED`);
                  }
                }

                // 지연 시간
                if (delay && delay > 0) {
                  await new Promise((resolve) => setTimeout(resolve, delay));
                }

                const result = await task.execute(task.abortController!);

                if (task.abortController!.signal.aborted) {
                  task.status = "COMPLETED";
                  await this.onTaskStatusChange(task.id, "COMPLETED");

                  resolve({
                    success: true,
                    result: undefined,
                    taskId: task.id,
                    timestamp: Date.now(),
                    instanceId: this.instanceId
                  });
                  return;
                }

                // resolve 제어 로직
                if (options.control) {
                  const control = options.control;

                  if (control.delay && control.delay > 0) {
                    await new Promise((resolve) => setTimeout(resolve, control.delay));
                  }

                  // 수동 resolve 제어
                  if (control.manual) {
                    task.status = "MANUAL_PENDING";
                    task.manualResolver = { resolve, reject, result };

                    // 대기 큐에 추가하고 상태 변경 알림
                    this.pendingTaskQueue.push(task as Task<unknown>);
                    await this.onTaskStatusChange(task.id, "MANUAL_PENDING");
                    return;
                  }

                  // 신호 대기
                  if (control.signal) {
                    task.status = "SIGNAL_PENDING";
                    task.manualResolver = { resolve, reject, result };

                    // 신호 리스너 등록
                    if (!this.signalListeners.has(control.signal)) {
                      this.signalListeners.set(control.signal, new Set());
                    }
                    this.signalListeners.get(control.signal)!.add(task.id);

                    // 대기 큐에 추가하고 상태 변경 알림
                    this.pendingTaskQueue.push(task as Task<unknown>);
                    await this.onTaskStatusChange(task.id, "SIGNAL_PENDING");
                    return;
                  }

                  // 조건부 resolve 제어
                  if (control.condition) {
                    const conditionMet = await control.condition();
                    if (!conditionMet) {
                      task.status = "MANUAL_PENDING";
                      task.manualResolver = { resolve, reject, result };

                      // 대기 큐에 추가하고 상태 변경 알림
                      this.pendingTaskQueue.push(task as Task<unknown>);
                      await this.onTaskStatusChange(task.id, "MANUAL_PENDING");
                      return;
                    }
                  }
                }

                task.status = "COMPLETED";

                // 상태 변경 알림
                await this.onTaskStatusChange(task.id, "COMPLETED");

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
                    // TODO: 롤백 실패 처리
                  }
                }

                // 상태 변경 알림
                await this.onTaskStatusChange(task.id, task.status);
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

      // 상태 변경 알림
      await this.onTaskStatusChange(taskId, "COMPLETED");

      return true;
    }

    return false;
  }

  public async resolveAllPending() {
    const pendingTasks = Array.from(this.tasks.values()).filter((task) =>
      ["PENDING", "MANUAL_PENDING", "SIGNAL_PENDING"].includes(task.status)
    );

    await Promise.all(pendingTasks.map((task) => this.resolveTask(task.id)));
  }
}

const instance = new TaskManager();

export default instance;

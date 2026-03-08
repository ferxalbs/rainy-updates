import { McpToolError } from "./errors.js";

type Task<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class McpRequestScheduler {
  private readonly maxInflight: number;
  private readonly maxQueue: number;
  private inflight = 0;
  private readonly queue: Array<Task<unknown>> = [];

  constructor(maxInflight = 4, maxQueue = 64) {
    this.maxInflight = Math.max(1, maxInflight);
    this.maxQueue = Math.max(0, maxQueue);
  }

  getState(): { inflight: number; queued: number; maxInflight: number; maxQueue: number } {
    return {
      inflight: this.inflight,
      queued: this.queue.length,
      maxInflight: this.maxInflight,
      maxQueue: this.maxQueue,
    };
  }

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.inflight < this.maxInflight) {
      return this.execute(task);
    }

    if (this.queue.length >= this.maxQueue) {
      return Promise.reject(
        new McpToolError({
          code: "OVERLOADED",
          message: "MCP server queue is full. Retry with narrower scope or later.",
          retryable: true,
          details: this.getState(),
        }),
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: task as () => Promise<unknown>,
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  private execute<T>(task: () => Promise<T>): Promise<T> {
    this.inflight += 1;
    return task().finally(() => {
      this.inflight = Math.max(0, this.inflight - 1);
      this.runNext();
    });
  }

  private runNext(): void {
    if (this.inflight >= this.maxInflight) return;
    const next = this.queue.shift();
    if (!next) return;

    this.execute(next.run as () => Promise<unknown>).then(next.resolve, next.reject);
  }
}

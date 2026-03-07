import type { LogLevel, ServiceContext, ServiceEvent } from "../types/index.js";

const LOG_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

export function createServiceContext(
  context: Partial<ServiceContext> & Pick<ServiceContext, "cwd">,
): ServiceContext {
  return {
    mode: context.mode ?? "cli",
    silent: context.silent ?? false,
    cwd: context.cwd,
    logLevel: context.logLevel ?? "info",
    onEvent: context.onEvent,
  };
}

export function emitServiceEvent(
  context: ServiceContext | undefined,
  event: ServiceEvent,
): void {
  if (!context || context.silent) return;
  if (LOG_ORDER[event.level] > LOG_ORDER[context.logLevel]) return;
  context.onEvent?.(event);
}

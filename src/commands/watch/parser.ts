import path from "node:path";
import type { WatchOptions } from "../../types/index.js";
import { getRuntimeCwd } from "../../utils/runtime.js";

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function parseWatchArgs(args: string[]): WatchOptions {
  const options: WatchOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    action: "start",
    intervalMs: DEFAULT_INTERVAL_MS,
    severity: undefined,
    notify: undefined,
    webhook: undefined,
    daemon: false,
    decisionPlanFile: undefined,
    pidFile: undefined,
    stateFile: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (!current.startsWith("-") && (current === "stop" || current === "run")) {
      options.action = current;
      continue;
    }
    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");
    if (current === "--workspace") {
      options.workspace = true;
      continue;
    }
    if (current === "--interval" && next) {
      options.intervalMs = parseDurationMs(next);
      index += 1;
      continue;
    }
    if (current === "--interval") throw new Error("Missing value for --interval");
    if (current === "--severity" && next) {
      if (!["critical", "high", "medium", "low"].includes(next)) {
        throw new Error("--severity must be critical, high, medium, or low");
      }
      options.severity = next as WatchOptions["severity"];
      index += 1;
      continue;
    }
    if (current === "--severity") throw new Error("Missing value for --severity");
    if (current === "--notify" && next) {
      if (!["slack", "discord", "http"].includes(next)) {
        throw new Error("--notify must be slack, discord, or http");
      }
      options.notify = next as WatchOptions["notify"];
      index += 1;
      continue;
    }
    if (current === "--notify") throw new Error("Missing value for --notify");
    if (current === "--webhook" && next) {
      options.webhook = next;
      index += 1;
      continue;
    }
    if (current === "--webhook") throw new Error("Missing value for --webhook");
    if (current === "--plan-file" && next) {
      options.decisionPlanFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--plan-file") throw new Error("Missing value for --plan-file");
    if (current === "--daemon") {
      options.daemon = true;
      continue;
    }
    if (current.startsWith("-")) throw new Error(`Unknown watch option: ${current}`);
    throw new Error(`Unexpected watch argument: ${current}`);
  }

  options.pidFile = path.join(options.cwd, ".rainy", "watch.pid");
  options.stateFile = path.join(options.cwd, ".rainy", "watch-state.json");
  return options;
}

function parseDurationMs(value: string): number {
  const match = value.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) {
    throw new Error("--interval must be a duration like 30m, 6h, or 1d");
  }
  const amount = Number(match[1]);
  const unit = match[2] ?? "ms";
  const multiplier =
    unit === "d"
      ? 24 * 60 * 60 * 1000
      : unit === "h"
        ? 60 * 60 * 1000
        : unit === "m"
          ? 60 * 1000
          : unit === "s"
            ? 1000
            : 1;
  return amount * multiplier;
}

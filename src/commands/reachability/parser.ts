import path from "node:path";
import type { ReachabilityOptions } from "../../types/index.js";
import { getRuntimeCwd, writeStdout } from "../../utils/runtime.js";

export function parseReachabilityArgs(args: string[]): ReachabilityOptions {
  const options: ReachabilityOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    severity: undefined,
    format: "table",
    jsonFile: undefined,
    exceptionsFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

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

    if (current === "--severity" && next) {
      if (!["critical", "high", "medium", "low"].includes(next)) {
        throw new Error("--severity must be critical, high, medium, or low");
      }
      options.severity = next as ReachabilityOptions["severity"];
      index += 1;
      continue;
    }
    if (current === "--severity") throw new Error("Missing value for --severity");

    if (current === "--format" && next) {
      if (next !== "table" && next !== "json" && next !== "summary") {
        throw new Error("--format must be table, json, or summary");
      }
      options.format = next;
      index += 1;
      continue;
    }
    if (current === "--format") throw new Error("Missing value for --format");

    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--json-file") throw new Error("Missing value for --json-file");

    if (current === "--exceptions-file" && next) {
      options.exceptionsFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--exceptions-file") throw new Error("Missing value for --exceptions-file");

    if (current === "--concurrency" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--concurrency must be a positive integer");
      }
      options.concurrency = parsed;
      index += 1;
      continue;
    }
    if (current === "--concurrency") throw new Error("Missing value for --concurrency");

    if (current === "--registry-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--registry-timeout-ms must be a positive integer");
      }
      options.registryTimeoutMs = parsed;
      index += 1;
      continue;
    }
    if (current === "--registry-timeout-ms") {
      throw new Error("Missing value for --registry-timeout-ms");
    }

    if (current === "--help" || current === "-h") {
      writeStdout(REACHABILITY_HELP);
      process.exit(0);
    }

    if (current.startsWith("-")) throw new Error(`Unknown reachability option: ${current}`);
    throw new Error(`Unexpected reachability argument: ${current}`);
  }

  if (options.jsonFile && options.format !== "json") {
    options.format = "json";
  }

  return options;
}

const REACHABILITY_HELP = `
rup reachability — Estimate exploitability reachability for advisory findings

Usage:
  rup reachability [options]

Options:
  --workspace
  --severity critical|high|medium|low
  --exceptions-file <path>
  --format table|json|summary
  --json-file <path>
  --concurrency <n>
  --registry-timeout-ms <n>
  --cwd <path>
`.trimStart();

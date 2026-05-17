import path from "node:path";
import type { ExplainOptions } from "../../types/index.js";
import { getRuntimeCwd } from "../../utils/runtime.js";

export function parseExplainArgs(args: string[]): ExplainOptions {
  const options: ExplainOptions = {
    cwd: getRuntimeCwd(),
    packageName: "",
    fromVersion: undefined,
    toVersion: undefined,
    workspace: false,
    format: "table",
    jsonFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    cacheTtlSeconds: 3600,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (!current.startsWith("-") && !options.packageName) {
      options.packageName = current;
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
    if (current === "--from" && next) {
      options.fromVersion = next;
      index += 1;
      continue;
    }
    if (current === "--from") throw new Error("Missing value for --from");
    if (current === "--to" && next) {
      options.toVersion = next;
      index += 1;
      continue;
    }
    if (current === "--to") throw new Error("Missing value for --to");
    if (current === "--format" && next) {
      if (next !== "table" && next !== "json" && next !== "minimal") {
        throw new Error("--format must be table, json, or minimal");
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
    if (current.startsWith("-")) throw new Error(`Unknown explain option: ${current}`);
    throw new Error(`Unexpected explain argument: ${current}`);
  }

  if (!options.packageName) {
    throw new Error("explain requires a package name: rup explain <package>");
  }

  return options;
}

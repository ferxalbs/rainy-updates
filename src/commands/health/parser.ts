import path from "node:path";
import process from "node:process";
import type { HealthOptions } from "../../types/index.js";

export function parseHealthArgs(args: string[]): HealthOptions {
  const options: HealthOptions = {
    cwd: process.cwd(),
    workspace: false,
    staleDays: 365,
    includeDeprecated: true,
    includeAlternatives: false,
    reportFormat: "table",
    jsonFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
  };

  let index = 0;
  while (index < args.length) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 2;
      continue;
    }
    if (current === "--cwd") throw new Error("Missing value for --cwd");

    if (current === "--workspace") {
      options.workspace = true;
      index += 1;
      continue;
    }

    if (current === "--stale" && next) {
      // Accept "12m" → 365, "6m" → 180, "365d" → 365, or plain number
      const match = next.match(/^(\d+)(m|d)?$/);
      if (!match)
        throw new Error(
          "--stale must be a number of days or a duration like 12m or 180d",
        );
      const value = parseInt(match[1], 10);
      const unit = match[2] ?? "d";
      options.staleDays = unit === "m" ? value * 30 : value;
      index += 2;
      continue;
    }
    if (current === "--stale") throw new Error("Missing value for --stale");

    if (current === "--deprecated") {
      options.includeDeprecated = true;
      index += 1;
      continue;
    }
    if (current === "--no-deprecated") {
      options.includeDeprecated = false;
      index += 1;
      continue;
    }
    if (current === "--alternatives") {
      options.includeAlternatives = true;
      index += 1;
      continue;
    }

    if (current === "--report" && next) {
      if (next !== "table" && next !== "json")
        throw new Error("--report must be table or json");
      options.reportFormat = next;
      index += 2;
      continue;
    }
    if (current === "--report") throw new Error("Missing value for --report");

    if (current === "--json-file" && next) {
      options.jsonFile = path.resolve(options.cwd, next);
      index += 2;
      continue;
    }
    if (current === "--json-file")
      throw new Error("Missing value for --json-file");

    if (current === "--concurrency" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0)
        throw new Error("--concurrency must be positive integer");
      options.concurrency = parsed;
      index += 2;
      continue;
    }
    if (current === "--concurrency")
      throw new Error("Missing value for --concurrency");

    if (current.startsWith("-"))
      throw new Error(`Unknown health option: ${current}`);
    throw new Error(`Unexpected health argument: ${current}`);
  }

  return options;
}

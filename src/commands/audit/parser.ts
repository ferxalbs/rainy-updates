import path from "node:path";
import process from "node:process";
import type { AuditOptions, AuditSeverity } from "../../types/index.js";

const SEVERITY_LEVELS: AuditSeverity[] = ["critical", "high", "medium", "low"];

export function parseSeverity(value: string): AuditSeverity {
  if (SEVERITY_LEVELS.includes(value as AuditSeverity)) {
    return value as AuditSeverity;
  }
  throw new Error(
    `--severity must be critical, high, medium, or low. Got: ${value}`,
  );
}

export function parseAuditArgs(args: string[]): AuditOptions {
  const options: AuditOptions = {
    cwd: process.cwd(),
    workspace: false,
    severity: undefined,
    fix: false,
    dryRun: false,
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

    if (current === "--severity" && next) {
      options.severity = parseSeverity(next);
      index += 2;
      continue;
    }
    if (current === "--severity")
      throw new Error("Missing value for --severity");

    if (current === "--fix") {
      options.fix = true;
      index += 1;
      continue;
    }
    if (current === "--dry-run") {
      options.dryRun = true;
      index += 1;
      continue;
    }

    if (current === "--report" && next) {
      if (next !== "table" && next !== "json") {
        throw new Error("--report must be table or json");
      }
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
        throw new Error("--concurrency must be a positive integer");
      options.concurrency = parsed;
      index += 2;
      continue;
    }
    if (current === "--concurrency")
      throw new Error("Missing value for --concurrency");

    if (current.startsWith("-"))
      throw new Error(`Unknown audit option: ${current}`);
    throw new Error(`Unexpected audit argument: ${current}`);
  }

  return options;
}

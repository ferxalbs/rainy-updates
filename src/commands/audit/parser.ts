import path from "node:path";
import process from "node:process";
import type {
  AuditOptions,
  AuditSeverity,
  AuditSourceMode,
} from "../../types/index.js";

const SEVERITY_LEVELS: AuditSeverity[] = ["critical", "high", "medium", "low"];
const SOURCE_MODES: AuditSourceMode[] = ["auto", "osv", "github", "all"];

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
    commit: false,
    packageManager: "auto",
    reportFormat: "table",
    sourceMode: "auto",
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
    if (current === "--commit") {
      options.commit = true;
      index += 1;
      continue;
    }
    if (current === "--pm" && next) {
      const valid = ["auto", "npm", "pnpm", "bun", "yarn"];
      if (!valid.includes(next))
        throw new Error(`--pm must be one of: ${valid.join(", ")}`);
      options.packageManager = next as AuditOptions["packageManager"];
      index += 2;
      continue;
    }
    if (current === "--pm") throw new Error("Missing value for --pm");

    if (current === "--report" && next) {
      if (next !== "table" && next !== "json" && next !== "summary") {
        throw new Error("--report must be table, summary, or json");
      }
      options.reportFormat = next as AuditOptions["reportFormat"];
      index += 2;
      continue;
    }
    if (current === "--report") throw new Error("Missing value for --report");

    if (current === "--summary") {
      options.reportFormat = "summary";
      index += 1;
      continue;
    }

    if (current === "--source" && next) {
      if (!SOURCE_MODES.includes(next as AuditSourceMode)) {
        throw new Error(`--source must be one of: ${SOURCE_MODES.join(", ")}`);
      }
      options.sourceMode = next as AuditSourceMode;
      index += 2;
      continue;
    }
    if (current === "--source") throw new Error("Missing value for --source");

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

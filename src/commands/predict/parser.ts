import path from "node:path";
import type { PredictOptions } from "../../types/index.js";
import {
  exitProcess,
  getRuntimeCwd,
  writeStdout,
} from "../../utils/runtime.js";

export function parsePredictArgs(args: string[]): PredictOptions {
  const options: PredictOptions = {
    cwd: getRuntimeCwd(),
    workspace: false,
    packageName: undefined,
    fromPlanFile: undefined,
    format: "table",
    jsonFile: undefined,
    includeChangelog: true,
    failOnRisk: false,
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
    if (current === "--from-plan" && next) {
      options.fromPlanFile = path.resolve(options.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--from-plan") throw new Error("Missing value for --from-plan");
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
    if (current === "--no-changelog") {
      options.includeChangelog = false;
      continue;
    }
    if (current === "--fail-on-risk") {
      options.failOnRisk = true;
      continue;
    }
    if (current === "--help" || current === "-h") {
      writeStdout(PREDICT_HELP);
      exitProcess(0);
    }
    if (current.startsWith("-")) throw new Error(`Unknown predict option: ${current}`);
    throw new Error(`Unexpected predict argument: ${current}`);
  }

  if (!options.packageName && !options.workspace && !options.fromPlanFile) {
    throw new Error(
      "predict requires one target: rup predict <package>, rup predict --workspace, or rup predict --from-plan <path>",
    );
  }

  if (options.packageName && options.workspace) {
    throw new Error("Use either a package target or --workspace, not both.");
  }
  if (options.packageName && options.fromPlanFile) {
    throw new Error("Use either a package target or --from-plan, not both.");
  }
  if (options.workspace && options.fromPlanFile) {
    throw new Error("Use either --workspace or --from-plan, not both.");
  }

  return options;
}

const PREDICT_HELP = `
rup predict — Estimate upgrade break risk before applying dependency changes

Usage:
  rup predict <package> [options]
  rup predict --workspace [options]
  rup predict --from-plan <path> [options]

Options:
  --workspace            Analyze the full workspace update set
  --from-plan <path>     Analyze an existing decision plan file
  --format table|json|minimal
  --json-file <path>     Write JSON predict report to file
  --no-changelog         Skip changelog/release note enrichment
  --fail-on-risk         Exit code 1 when predicted risk is Moderate or higher
  --cwd <path>
`.trimStart();

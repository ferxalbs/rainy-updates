import path from "node:path";
import process from "node:process";
import { loadConfig } from "../config/loader.js";
import type {
  BaselineOptions,
  CheckOptions,
  DependencyKind,
  FailOnLevel,
  OutputFormat,
  TargetLevel,
  UpgradeOptions,
} from "../types/index.js";
import type { InitCiMode, InitCiSchedule } from "./init-ci.js";

const DEFAULT_INCLUDE_KINDS: DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const KNOWN_COMMANDS = ["check", "upgrade", "warm-cache", "init-ci", "baseline"] as const;

export type ParsedCliArgs =
  | { command: "check"; options: CheckOptions }
  | { command: "upgrade"; options: UpgradeOptions }
  | { command: "warm-cache"; options: CheckOptions }
  | { command: "init-ci"; options: { cwd: string; force: boolean; mode: InitCiMode; schedule: InitCiSchedule } }
  | { command: "baseline"; options: BaselineOptions & { action: "save" | "check" } };

export async function parseCliArgs(argv: string[]): Promise<ParsedCliArgs> {
  const firstArg = argv[0];
  const isKnownCommand = KNOWN_COMMANDS.includes(firstArg as (typeof KNOWN_COMMANDS)[number]);
  if (firstArg && !firstArg.startsWith("-") && !isKnownCommand) {
    throw new Error(`Unknown command: ${firstArg}`);
  }
  const command = isKnownCommand ? argv[0] : "check";
  const hasExplicitCommand = isKnownCommand;
  const args = hasExplicitCommand ? argv.slice(1) : argv.slice(0);

  const base: CheckOptions = {
    cwd: process.cwd(),
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: DEFAULT_INCLUDE_KINDS,
    ci: false,
    format: "table",
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 16,
    offline: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
  };

  let force = false;
  let initCiMode: InitCiMode = "enterprise";
  let initCiSchedule: InitCiSchedule = "weekly";
  let baselineAction: "save" | "check" = "check";
  let baselineFilePath = path.resolve(base.cwd, ".rainy-updates-baseline.json");

  let resolvedConfig = await loadConfig(base.cwd);
  applyConfig(base, resolvedConfig);

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    const next = args[index + 1];

    if (current === "--target" && next) {
      base.target = ensureTarget(next);
      index += 1;
      continue;
    }
    if (current === "--target") {
      throw new Error("Missing value for --target");
    }

    if (current === "--filter" && next) {
      base.filter = next;
      index += 1;
      continue;
    }
    if (current === "--filter") {
      throw new Error("Missing value for --filter");
    }

    if (current === "--reject" && next) {
      base.reject = next;
      index += 1;
      continue;
    }
    if (current === "--reject") {
      throw new Error("Missing value for --reject");
    }

    if (current === "--cwd" && next) {
      base.cwd = path.resolve(next);
      resolvedConfig = await loadConfig(base.cwd);
      applyConfig(base, resolvedConfig);
      baselineFilePath = path.resolve(base.cwd, ".rainy-updates-baseline.json");
      index += 1;
      continue;
    }
    if (current === "--cwd") {
      throw new Error("Missing value for --cwd");
    }

    if (current === "--cache-ttl" && next) {
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error("--cache-ttl must be a positive number");
      }
      base.cacheTtlSeconds = parsed;
      index += 1;
      continue;
    }
    if (current === "--cache-ttl") {
      throw new Error("Missing value for --cache-ttl");
    }

    if (current === "--format" && next) {
      base.format = ensureFormat(next);
      index += 1;
      continue;
    }
    if (current === "--format") {
      throw new Error("Missing value for --format");
    }

    if (current === "--ci") {
      base.ci = true;
      continue;
    }

    if (current === "--workspace") {
      base.workspace = true;
      continue;
    }

    if (current === "--json-file" && next) {
      base.jsonFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--json-file") {
      throw new Error("Missing value for --json-file");
    }

    if (current === "--github-output" && next) {
      base.githubOutputFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--github-output") {
      throw new Error("Missing value for --github-output");
    }

    if (current === "--sarif-file" && next) {
      base.sarifFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--sarif-file") {
      throw new Error("Missing value for --sarif-file");
    }

    if (current === "--concurrency" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--concurrency must be a positive integer");
      }
      base.concurrency = parsed;
      index += 1;
      continue;
    }
    if (current === "--concurrency") {
      throw new Error("Missing value for --concurrency");
    }

    if (current === "--offline") {
      base.offline = true;
      continue;
    }

    if (current === "--policy-file" && next) {
      base.policyFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--policy-file") {
      throw new Error("Missing value for --policy-file");
    }

    if (current === "--pr-report-file" && next) {
      base.prReportFile = path.resolve(next);
      index += 1;
      continue;
    }
    if (current === "--pr-report-file") {
      throw new Error("Missing value for --pr-report-file");
    }

    if (current === "--force") {
      force = true;
      continue;
    }

    if (current === "--install" && command === "upgrade") {
      continue;
    }

    if (current === "--sync" && command === "upgrade") {
      continue;
    }

    if (current === "--pm" && next && command === "upgrade") {
      parsePackageManager(args);
      index += 1;
      continue;
    }
    if (current === "--pm" && command === "upgrade") {
      throw new Error("Missing value for --pm");
    }

    if (current === "--mode" && next) {
      initCiMode = ensureInitCiMode(next);
      index += 1;
      continue;
    }
    if (current === "--mode") {
      throw new Error("Missing value for --mode");
    }

    if (current === "--schedule" && next) {
      initCiSchedule = ensureInitCiSchedule(next);
      index += 1;
      continue;
    }
    if (current === "--schedule") {
      throw new Error("Missing value for --schedule");
    }

    if (current === "--dep-kinds" && next) {
      base.includeKinds = parseDependencyKinds(next);
      index += 1;
      continue;
    }
    if (current === "--dep-kinds") {
      throw new Error("Missing value for --dep-kinds");
    }

    if (current === "--fail-on" && next) {
      base.failOn = ensureFailOn(next);
      index += 1;
      continue;
    }
    if (current === "--fail-on") {
      throw new Error("Missing value for --fail-on");
    }

    if (current === "--max-updates" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--max-updates must be a non-negative integer");
      }
      base.maxUpdates = parsed;
      index += 1;
      continue;
    }
    if (current === "--max-updates") {
      throw new Error("Missing value for --max-updates");
    }

    if (current === "--save") {
      baselineAction = "save";
      continue;
    }

    if (current === "--check") {
      baselineAction = "check";
      continue;
    }

    if (current === "--file" && next) {
      baselineFilePath = path.resolve(base.cwd, next);
      index += 1;
      continue;
    }
    if (current === "--file") {
      throw new Error("Missing value for --file");
    }

    if (current.startsWith("-")) {
      throw new Error(`Unknown option: ${current}`);
    }

    throw new Error(`Unexpected argument: ${current}`);
  }

  if (command === "upgrade") {
    const configPm = resolvedConfig.packageManager;
    const cliPm = parsePackageManager(args);
    const upgradeOptions: UpgradeOptions = {
      ...base,
      install: args.includes("--install") || resolvedConfig.install === true,
      packageManager: cliPm === "auto" ? (configPm ?? "auto") : cliPm,
      sync: args.includes("--sync") || resolvedConfig.sync === true,
    };

    return { command, options: upgradeOptions };
  }

  if (command === "warm-cache") {
    return { command, options: base };
  }

  if (command === "init-ci") {
    return {
      command,
      options: {
        cwd: base.cwd,
        force,
        mode: initCiMode,
        schedule: initCiSchedule,
      },
    };
  }

  if (command === "baseline") {
    return {
      command,
      options: {
        action: baselineAction,
        cwd: base.cwd,
        workspace: base.workspace,
        includeKinds: base.includeKinds,
        filePath: baselineFilePath,
        ci: base.ci,
      },
    };
  }

  return {
    command: "check",
    options: base,
  };
}

function applyConfig(base: CheckOptions, config: Partial<UpgradeOptions>): void {
  if (config.target) base.target = config.target;
  if (config.filter !== undefined) base.filter = config.filter;
  if (config.reject !== undefined) base.reject = config.reject;
  if (typeof config.cacheTtlSeconds === "number") base.cacheTtlSeconds = config.cacheTtlSeconds;
  if (Array.isArray(config.includeKinds) && config.includeKinds.length > 0) base.includeKinds = config.includeKinds;
  if (typeof config.ci === "boolean") base.ci = config.ci;
  if (config.format) base.format = config.format;
  if (typeof config.workspace === "boolean") base.workspace = config.workspace;
  if (typeof config.jsonFile === "string") base.jsonFile = path.resolve(base.cwd, config.jsonFile);
  if (typeof config.githubOutputFile === "string") {
    base.githubOutputFile = path.resolve(base.cwd, config.githubOutputFile);
  }
  if (typeof config.sarifFile === "string") {
    base.sarifFile = path.resolve(base.cwd, config.sarifFile);
  }
  if (typeof config.concurrency === "number" && Number.isInteger(config.concurrency) && config.concurrency > 0) {
    base.concurrency = config.concurrency;
  }
  if (typeof config.offline === "boolean") {
    base.offline = config.offline;
  }
  if (typeof config.policyFile === "string") {
    base.policyFile = path.resolve(base.cwd, config.policyFile);
  }
  if (typeof config.prReportFile === "string") {
    base.prReportFile = path.resolve(base.cwd, config.prReportFile);
  }
  if (typeof config.failOn === "string") {
    base.failOn = ensureFailOn(config.failOn);
  }
  if (typeof config.maxUpdates === "number" && Number.isInteger(config.maxUpdates) && config.maxUpdates >= 0) {
    base.maxUpdates = config.maxUpdates;
  }
}

function parsePackageManager(args: string[]): "auto" | "npm" | "pnpm" {
  const index = args.indexOf("--pm");
  if (index === -1) return "auto";
  const value = args[index + 1] ?? "auto";
  if (value === "auto" || value === "npm" || value === "pnpm") {
    return value;
  }
  throw new Error("--pm must be auto, npm or pnpm");
}

function ensureTarget(value: string): TargetLevel {
  if (value === "patch" || value === "minor" || value === "major" || value === "latest") {
    return value;
  }
  throw new Error("--target must be patch, minor, major, latest");
}

function ensureFormat(value: string): OutputFormat {
  if (value === "table" || value === "json" || value === "minimal" || value === "github") {
    return value;
  }
  throw new Error("--format must be table, json, minimal or github");
}

function parseDependencyKinds(value: string): DependencyKind[] {
  const mapped = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item): DependencyKind => {
      if (item === "dependencies" || item === "deps") return "dependencies";
      if (item === "devDependencies" || item === "dev") return "devDependencies";
      if (item === "optionalDependencies" || item === "optional") return "optionalDependencies";
      if (item === "peerDependencies" || item === "peer") return "peerDependencies";
      throw new Error(`Unknown dependency kind: ${item}`);
    });

  if (mapped.length === 0) {
    throw new Error("--dep-kinds requires at least one value");
  }

  return Array.from(new Set(mapped));
}

function ensureInitCiMode(value: string): InitCiMode {
  if (value === "minimal" || value === "strict" || value === "enterprise") {
    return value;
  }
  throw new Error("--mode must be minimal, strict or enterprise");
}

function ensureInitCiSchedule(value: string): InitCiSchedule {
  if (value === "weekly" || value === "daily" || value === "off") {
    return value;
  }
  throw new Error("--schedule must be weekly, daily or off");
}

function ensureFailOn(value: string): FailOnLevel {
  if (value === "none" || value === "patch" || value === "minor" || value === "major" || value === "any") {
    return value;
  }
  throw new Error("--fail-on must be none, patch, minor, major or any");
}

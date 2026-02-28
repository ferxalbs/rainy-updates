import path from "node:path";
import process from "node:process";
import { loadConfig } from "../config/loader.js";
import type {
  BaselineOptions,
  CheckOptions,
  CiProfile,
  DependencyKind,
  FailOnLevel,
  GroupBy,
  LockfileMode,
  OutputFormat,
  TargetLevel,
  UpgradeOptions,
  LogLevel,
  AuditOptions,
  BisectOptions,
  HealthOptions,
} from "../types/index.js";
import type { InitCiMode, InitCiSchedule } from "./init-ci.js";

const DEFAULT_INCLUDE_KINDS: DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];
const KNOWN_COMMANDS = [
  "check",
  "upgrade",
  "warm-cache",
  "init-ci",
  "baseline",
  "ci",
  "bisect",
  "audit",
  "health",
] as const;

export type ParsedCliArgs =
  | { command: "check"; options: CheckOptions }
  | { command: "upgrade"; options: UpgradeOptions }
  | { command: "warm-cache"; options: CheckOptions }
  | { command: "ci"; options: CheckOptions }
  | {
      command: "init-ci";
      options: {
        cwd: string;
        force: boolean;
        mode: InitCiMode;
        schedule: InitCiSchedule;
      };
    }
  | {
      command: "baseline";
      options: BaselineOptions & { action: "save" | "check" };
    }
  | { command: "bisect"; options: BisectOptions }
  | { command: "audit"; options: AuditOptions }
  | { command: "health"; options: HealthOptions };

export async function parseCliArgs(argv: string[]): Promise<ParsedCliArgs> {
  const firstArg = argv[0];
  const isKnownCommand = KNOWN_COMMANDS.includes(
    firstArg as (typeof KNOWN_COMMANDS)[number],
  );
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
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: "chore/rainy-updates",
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    fixPrBatchSize: undefined,
    noPrReport: false,
    logLevel: "info",
    groupBy: "none",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
  };

  let force = false;
  let initCiMode: InitCiMode = "enterprise";
  let initCiSchedule: InitCiSchedule = "weekly";
  let baselineAction: "save" | "check" = "check";
  let baselineFilePath = path.resolve(base.cwd, ".rainy-updates-baseline.json");
  let jsonFileRaw: string | undefined;
  let githubOutputRaw: string | undefined;
  let sarifFileRaw: string | undefined;
  let policyFileRaw: string | undefined;
  let prReportFileRaw: string | undefined;

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
      jsonFileRaw = next;
      index += 1;
      continue;
    }
    if (current === "--json-file") {
      throw new Error("Missing value for --json-file");
    }

    if (current === "--github-output" && next) {
      githubOutputRaw = next;
      index += 1;
      continue;
    }
    if (current === "--github-output") {
      throw new Error("Missing value for --github-output");
    }

    if (current === "--sarif-file" && next) {
      sarifFileRaw = next;
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

    if (current === "--registry-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--registry-timeout-ms must be a positive integer");
      }
      base.registryTimeoutMs = parsed;
      index += 1;
      continue;
    }
    if (current === "--registry-timeout-ms") {
      throw new Error("Missing value for --registry-timeout-ms");
    }

    if (current === "--registry-retries" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--registry-retries must be a positive integer");
      }
      base.registryRetries = parsed;
      index += 1;
      continue;
    }
    if (current === "--registry-retries") {
      throw new Error("Missing value for --registry-retries");
    }

    if (current === "--offline") {
      base.offline = true;
      continue;
    }

    if (current === "--stream") {
      base.stream = true;
      continue;
    }

    if (current === "--policy-file" && next) {
      policyFileRaw = next;
      index += 1;
      continue;
    }
    if (current === "--policy-file") {
      throw new Error("Missing value for --policy-file");
    }

    if (current === "--pr-report-file" && next) {
      prReportFileRaw = next;
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

    if (current === "--fix-pr") {
      base.fixPr = true;
      continue;
    }

    if (current === "--fix-branch" && next) {
      base.fixBranch = next;
      index += 1;
      continue;
    }
    if (current === "--fix-branch") {
      throw new Error("Missing value for --fix-branch");
    }

    if (current === "--fix-commit-message" && next) {
      base.fixCommitMessage = next;
      index += 1;
      continue;
    }
    if (current === "--fix-commit-message") {
      throw new Error("Missing value for --fix-commit-message");
    }

    if (current === "--fix-dry-run") {
      base.fixDryRun = true;
      continue;
    }

    if (current === "--no-pr-report") {
      base.noPrReport = true;
      continue;
    }

    if (current === "--fix-pr-no-checkout") {
      base.fixPrNoCheckout = true;
      continue;
    }

    if (current === "--fix-pr-batch-size" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--fix-pr-batch-size must be a positive integer");
      }
      base.fixPrBatchSize = parsed;
      index += 1;
      continue;
    }
    if (current === "--fix-pr-batch-size") {
      throw new Error("Missing value for --fix-pr-batch-size");
    }

    if (current === "--log-level" && next) {
      base.logLevel = ensureLogLevel(next);
      index += 1;
      continue;
    }
    if (current === "--log-level") {
      throw new Error("Missing value for --log-level");
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
      if (command === "init-ci") {
        initCiMode = ensureInitCiMode(next);
      } else {
        base.ciProfile = ensureCiProfile(next);
      }
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

    if (current === "--group-by" && next) {
      base.groupBy = ensureGroupBy(next);
      index += 1;
      continue;
    }
    if (current === "--group-by") {
      throw new Error("Missing value for --group-by");
    }

    if (current === "--group-max" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--group-max must be a positive integer");
      }
      base.groupMax = parsed;
      index += 1;
      continue;
    }
    if (current === "--group-max") {
      throw new Error("Missing value for --group-max");
    }

    if (current === "--cooldown-days" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error("--cooldown-days must be a non-negative integer");
      }
      base.cooldownDays = parsed;
      index += 1;
      continue;
    }
    if (current === "--cooldown-days") {
      throw new Error("Missing value for --cooldown-days");
    }

    if (current === "--pr-limit" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--pr-limit must be a positive integer");
      }
      base.prLimit = parsed;
      index += 1;
      continue;
    }
    if (current === "--pr-limit") {
      throw new Error("Missing value for --pr-limit");
    }

    if (current === "--only-changed") {
      base.onlyChanged = true;
      continue;
    }

    if (current === "--lockfile-mode" && next) {
      base.lockfileMode = ensureLockfileMode(next);
      index += 1;
      continue;
    }
    if (current === "--lockfile-mode") {
      throw new Error("Missing value for --lockfile-mode");
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

  if (jsonFileRaw) {
    base.jsonFile = path.resolve(base.cwd, jsonFileRaw);
  }
  if (githubOutputRaw) {
    base.githubOutputFile = path.resolve(base.cwd, githubOutputRaw);
  }
  if (sarifFileRaw) {
    base.sarifFile = path.resolve(base.cwd, sarifFileRaw);
  }
  if (policyFileRaw) {
    base.policyFile = path.resolve(base.cwd, policyFileRaw);
  }
  if (prReportFileRaw) {
    base.prReportFile = path.resolve(base.cwd, prReportFileRaw);
  }

  if (base.noPrReport) {
    base.prReportFile = undefined;
  } else if (base.fixPr && !base.prReportFile) {
    base.prReportFile = path.resolve(base.cwd, ".artifacts/deps-report.md");
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

  if (command === "ci") {
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

  // ─── New v0.5.1 commands: lazy-parsed by isolated sub-parsers ────────────
  if (command === "bisect") {
    const { parseBisectArgs } = await import("../commands/bisect/parser.js");
    return { command, options: parseBisectArgs(args) };
  }

  if (command === "audit") {
    const { parseAuditArgs } = await import("../commands/audit/parser.js");
    return { command, options: parseAuditArgs(args) };
  }

  if (command === "health") {
    const { parseHealthArgs } = await import("../commands/health/parser.js");
    return { command, options: parseHealthArgs(args) };
  }

  return {
    command: "check",
    options: base,
  };
}

function applyConfig(
  base: CheckOptions,
  config: Partial<UpgradeOptions>,
): void {
  if (config.target) base.target = config.target;
  if (config.filter !== undefined) base.filter = config.filter;
  if (config.reject !== undefined) base.reject = config.reject;
  if (typeof config.cacheTtlSeconds === "number")
    base.cacheTtlSeconds = config.cacheTtlSeconds;
  if (Array.isArray(config.includeKinds) && config.includeKinds.length > 0)
    base.includeKinds = config.includeKinds;
  if (typeof config.ci === "boolean") base.ci = config.ci;
  if (config.format) base.format = config.format;
  if (typeof config.workspace === "boolean") base.workspace = config.workspace;
  if (typeof config.jsonFile === "string")
    base.jsonFile = path.resolve(base.cwd, config.jsonFile);
  if (typeof config.githubOutputFile === "string") {
    base.githubOutputFile = path.resolve(base.cwd, config.githubOutputFile);
  }
  if (typeof config.sarifFile === "string") {
    base.sarifFile = path.resolve(base.cwd, config.sarifFile);
  }
  if (
    typeof config.concurrency === "number" &&
    Number.isInteger(config.concurrency) &&
    config.concurrency > 0
  ) {
    base.concurrency = config.concurrency;
  }
  if (
    typeof config.registryTimeoutMs === "number" &&
    Number.isInteger(config.registryTimeoutMs) &&
    config.registryTimeoutMs > 0
  ) {
    base.registryTimeoutMs = config.registryTimeoutMs;
  }
  if (
    typeof config.registryRetries === "number" &&
    Number.isInteger(config.registryRetries) &&
    config.registryRetries > 0
  ) {
    base.registryRetries = config.registryRetries;
  }
  if (typeof config.offline === "boolean") {
    base.offline = config.offline;
  }
  if (typeof config.stream === "boolean") {
    base.stream = config.stream;
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
  if (
    typeof config.maxUpdates === "number" &&
    Number.isInteger(config.maxUpdates) &&
    config.maxUpdates >= 0
  ) {
    base.maxUpdates = config.maxUpdates;
  }
  if (typeof config.fixPr === "boolean") {
    base.fixPr = config.fixPr;
  }
  if (typeof config.fixBranch === "string" && config.fixBranch.length > 0) {
    base.fixBranch = config.fixBranch;
  }
  if (
    typeof config.fixCommitMessage === "string" &&
    config.fixCommitMessage.length > 0
  ) {
    base.fixCommitMessage = config.fixCommitMessage;
  }
  if (typeof config.fixDryRun === "boolean") {
    base.fixDryRun = config.fixDryRun;
  }
  if (typeof config.fixPrNoCheckout === "boolean") {
    base.fixPrNoCheckout = config.fixPrNoCheckout;
  }
  if (
    typeof config.fixPrBatchSize === "number" &&
    Number.isInteger(config.fixPrBatchSize) &&
    config.fixPrBatchSize > 0
  ) {
    base.fixPrBatchSize = config.fixPrBatchSize;
  }
  if (typeof config.noPrReport === "boolean") {
    base.noPrReport = config.noPrReport;
  }
  if (typeof config.logLevel === "string") {
    base.logLevel = ensureLogLevel(config.logLevel);
  }
  if (typeof config.groupBy === "string") {
    base.groupBy = ensureGroupBy(config.groupBy);
  }
  if (
    typeof config.groupMax === "number" &&
    Number.isInteger(config.groupMax) &&
    config.groupMax > 0
  ) {
    base.groupMax = config.groupMax;
  }
  if (
    typeof config.cooldownDays === "number" &&
    Number.isInteger(config.cooldownDays) &&
    config.cooldownDays >= 0
  ) {
    base.cooldownDays = config.cooldownDays;
  }
  if (
    typeof config.prLimit === "number" &&
    Number.isInteger(config.prLimit) &&
    config.prLimit > 0
  ) {
    base.prLimit = config.prLimit;
  }
  if (typeof config.onlyChanged === "boolean") {
    base.onlyChanged = config.onlyChanged;
  }
  if (typeof config.ciProfile === "string") {
    base.ciProfile = ensureCiProfile(config.ciProfile);
  }
  if (typeof config.lockfileMode === "string") {
    base.lockfileMode = ensureLockfileMode(config.lockfileMode);
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
  if (
    value === "patch" ||
    value === "minor" ||
    value === "major" ||
    value === "latest"
  ) {
    return value;
  }
  throw new Error("--target must be patch, minor, major, latest");
}

function ensureFormat(value: string): OutputFormat {
  if (
    value === "table" ||
    value === "json" ||
    value === "minimal" ||
    value === "github" ||
    value === "metrics"
  ) {
    return value;
  }
  throw new Error("--format must be table, json, minimal, github or metrics");
}

function ensureLogLevel(value: string): LogLevel {
  if (
    value === "error" ||
    value === "warn" ||
    value === "info" ||
    value === "debug"
  ) {
    return value;
  }
  throw new Error("--log-level must be error, warn, info or debug");
}

function parseDependencyKinds(value: string): DependencyKind[] {
  const mapped = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item): DependencyKind => {
      if (item === "dependencies" || item === "deps") return "dependencies";
      if (item === "devDependencies" || item === "dev")
        return "devDependencies";
      if (item === "optionalDependencies" || item === "optional")
        return "optionalDependencies";
      if (item === "peerDependencies" || item === "peer")
        return "peerDependencies";
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
  if (
    value === "none" ||
    value === "patch" ||
    value === "minor" ||
    value === "major" ||
    value === "any"
  ) {
    return value;
  }
  throw new Error("--fail-on must be none, patch, minor, major or any");
}

function ensureGroupBy(value: string): GroupBy {
  if (
    value === "none" ||
    value === "name" ||
    value === "scope" ||
    value === "kind" ||
    value === "risk"
  ) {
    return value;
  }
  throw new Error("--group-by must be none, name, scope, kind or risk");
}

function ensureCiProfile(value: string): CiProfile {
  if (value === "minimal" || value === "strict" || value === "enterprise") {
    return value;
  }
  throw new Error("--mode must be minimal, strict or enterprise");
}

function ensureLockfileMode(value: string): LockfileMode {
  if (value === "preserve" || value === "update" || value === "error") {
    return value;
  }
  throw new Error("--lockfile-mode must be preserve, update or error");
}

import path from "node:path";
import process from "node:process";
import { loadConfig } from "../config/loader.js";
import type { CheckOptions, DependencyKind, OutputFormat, TargetLevel, UpgradeOptions } from "../types/index.js";

const DEFAULT_INCLUDE_KINDS: DependencyKind[] = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
];

export type ParsedCliArgs =
  | { command: "check"; options: CheckOptions }
  | { command: "upgrade"; options: UpgradeOptions };

export async function parseCliArgs(argv: string[]): Promise<ParsedCliArgs> {
  const command = argv[0] === "upgrade" ? "upgrade" : "check";
  const hasExplicitCommand = argv[0] === "check" || argv[0] === "upgrade";
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
  };

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

    if (current === "--filter" && next) {
      base.filter = next;
      index += 1;
      continue;
    }

    if (current === "--reject" && next) {
      base.reject = next;
      index += 1;
      continue;
    }

    if (current === "--cwd" && next) {
      base.cwd = path.resolve(next);
      resolvedConfig = await loadConfig(base.cwd);
      applyConfig(base, resolvedConfig);
      index += 1;
      continue;
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

    if (current === "--format" && next) {
      base.format = ensureFormat(next);
      index += 1;
      continue;
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

    if (current === "--github-output" && next) {
      base.githubOutputFile = path.resolve(next);
      index += 1;
      continue;
    }

    if (current === "--sarif-file" && next) {
      base.sarifFile = path.resolve(next);
      index += 1;
      continue;
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

    if (current === "--offline") {
      base.offline = true;
      continue;
    }

    if (current === "--dep-kinds" && next) {
      base.includeKinds = parseDependencyKinds(next);
      index += 1;
      continue;
    }
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

  return {
    command,
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

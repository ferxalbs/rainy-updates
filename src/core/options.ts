import path from "node:path";
import process from "node:process";
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

export function parseCliArgs(argv: string[]): ParsedCliArgs {
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
  };

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
  }

  if (command === "upgrade") {
    const upgradeOptions: UpgradeOptions = {
      ...base,
      install: args.includes("--install"),
      packageManager: parsePackageManager(args),
    };

    return { command, options: upgradeOptions };
  }

  return {
    command,
    options: base,
  };
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
  if (value === "table" || value === "json" || value === "minimal") {
    return value;
  }
  throw new Error("--format must be table, json or minimal");
}

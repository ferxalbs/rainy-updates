import path from "node:path";
import process from "node:process";
import type { BisectOptions } from "../../types/index.js";

export function parseBisectArgs(args: string[]): BisectOptions {
  const options: BisectOptions = {
    cwd: process.cwd(),
    packageName: "",
    versionRange: undefined,
    testCommand: "npm test",
    concurrency: 4,
    registryTimeoutMs: 8000,
    cacheTtlSeconds: 3600,
    dryRun: false,
  };

  let index = 0;
  while (index < args.length) {
    const current = args[index];
    const next = args[index + 1];

    if (!current.startsWith("-") && !options.packageName) {
      options.packageName = current;
      index += 1;
      continue;
    }

    if (current === "--cmd" && next) {
      options.testCommand = next;
      index += 2;
      continue;
    }
    if (current === "--cmd") {
      throw new Error("Missing value for --cmd");
    }

    if (current === "--range" && next) {
      options.versionRange = next;
      index += 2;
      continue;
    }
    if (current === "--range") {
      throw new Error("Missing value for --range");
    }

    if (current === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 2;
      continue;
    }
    if (current === "--cwd") {
      throw new Error("Missing value for --cwd");
    }

    if (current === "--dry-run") {
      options.dryRun = true;
      index += 1;
      continue;
    }

    if (current === "--registry-timeout-ms" && next) {
      const parsed = Number(next);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--registry-timeout-ms must be a positive integer");
      }
      options.registryTimeoutMs = parsed;
      index += 2;
      continue;
    }
    if (current === "--registry-timeout-ms") {
      throw new Error("Missing value for --registry-timeout-ms");
    }

    if (current.startsWith("-")) {
      throw new Error(`Unknown bisect option: ${current}`);
    }

    throw new Error(`Unexpected bisect argument: ${current}`);
  }

  if (!options.packageName) {
    throw new Error(
      'bisect requires a package name: rup bisect <package> --cmd "<test command>"',
    );
  }

  return options;
}

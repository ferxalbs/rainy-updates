import path from "node:path";
import { VersionCache } from "../../cache/cache.js";
import { detectPackageManagerDetails } from "../../pm/detect.js";
import { discoverPackageDirs } from "../../workspace/discover.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { GaCheck, GaOptions, GaResult } from "../../types/index.js";

export async function runGa(options: GaOptions): Promise<GaResult> {
  const packageManager = await detectPackageManagerDetails(options.cwd);
  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace, {
    git: options,
    includeDependents: options.affected === true,
  });
  const cache = await VersionCache.create();
  const checks: GaCheck[] = [];

  checks.push({
    name: "package-manager",
    status: packageManager.manager === "unknown" ? "warn" : "pass",
    detail:
      packageManager.manager === "unknown"
        ? "No supported lockfile was detected. Rainy can still run, but runtime/package verification will fall back to generic defaults."
        : `Detected package manager: ${packageManager.manager} via ${packageManager.source}${packageManager.lockfile ? ` (${packageManager.lockfile})` : ""}${packageManager.packageManagerField ? ` [${packageManager.packageManagerField}]` : ""}. Runtime and verification can align with this package ecosystem, including Bun.`,
  });

  checks.push({
    name: "workspace-discovery",
    status: packageDirs.length > 0 ? "pass" : "fail",
    detail: `Discovered ${packageDirs.length} package manifest path(s).`,
  });

  const lockfileCheck = await detectLockfile(options.cwd);
  checks.push(lockfileCheck);

  checks.push({
    name: "cache-backend",
    status: cache.backend === "sqlite" ? "pass" : cache.degraded ? "warn" : "pass",
    detail:
      cache.backend === "sqlite"
        ? "SQLite cache backend is available."
        : `File cache backend active${cache.fallbackReason ? ` (${cache.fallbackReason})` : "."}`,
  });

  const distBuildExists = await fileExists(path.resolve(options.cwd, "dist/bin/cli.js"));
  checks.push({
    name: "dist-build",
    status: distBuildExists ? "pass" : "warn",
    detail: distBuildExists
      ? "Built CLI entrypoint exists in dist/bin/cli.js."
      : "Built CLI entrypoint is missing; run the build before publishing a release artifact.",
  });

  const compiledBinaryExists = await fileExists(path.resolve(options.cwd, "dist/rup"));
  checks.push({
    name: "runtime-artifacts",
    status: compiledBinaryExists ? "pass" : "warn",
    detail: compiledBinaryExists
      ? "Compiled Bun runtime artifact exists in dist/rup."
      : "Compiled Bun runtime artifact is missing; run bun run build:exe before publishing Bun-first release artifacts.",
  });

  checks.push({
    name: "benchmark-gates",
    status:
      (await fileExists(path.resolve(options.cwd, "scripts/perf-smoke.mjs"))) &&
      (await fileExists(path.resolve(options.cwd, "scripts/benchmark.mjs")))
        ? "pass"
        : "warn",
    detail: "Benchmark scripts and perf smoke gates were checked for release readiness.",
  });

  checks.push({
    name: "docs-contract",
    status:
      (await fileExists(path.resolve(options.cwd, "README.md"))) &&
      (await fileExists(path.resolve(options.cwd, "CHANGELOG.md")))
        ? "pass"
        : "warn",
    detail: "README and CHANGELOG presence verified.",
  });

  const errors = checks.filter((check) => check.status === "fail").map((check) => check.detail);
  const warnings = checks.filter((check) => check.status === "warn").map((check) => check.detail);
  const result: GaResult = {
    ready: errors.length === 0,
    projectPath: options.cwd,
    packageManager: packageManager.manager,
    workspacePackages: packageDirs.length,
    cacheBackend: cache.backend,
    checks,
    warnings,
    errors,
  };

  writeStdout(renderGaResult(result) + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }
  return result;
}

function renderGaResult(result: GaResult): string {
  const lines = [
    `Project: ${result.projectPath}`,
    `GA Ready: ${result.ready ? "yes" : "no"}`,
    `Package Manager: ${result.packageManager}`,
    `Workspace Packages: ${result.workspacePackages}`,
    `Cache Backend: ${result.cacheBackend}`,
    "",
    "Checks:",
    ...result.checks.map((check) => `- [${check.status}] ${check.name}: ${check.detail}`),
  ];
  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }
  return lines.join("\n");
}

async function detectLockfile(cwd: string): Promise<GaCheck> {
  const lockfiles = [
    "pnpm-lock.yaml",
    "package-lock.json",
    "npm-shrinkwrap.json",
    "bun.lock",
    "yarn.lock",
  ];
  for (const candidate of lockfiles) {
    if (await fileExists(path.resolve(cwd, candidate))) {
      return {
        name: "lockfile",
        status: "pass",
        detail: `Detected lockfile: ${candidate}.`,
      };
    }
  }
  return {
    name: "lockfile",
    status: "warn",
    detail: "No supported lockfile was detected.",
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await Bun.file(filePath).exists();
  } catch {
    return false;
  }
}

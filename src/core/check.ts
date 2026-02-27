import path from "node:path";
import type { CheckOptions, CheckResult, PackageDependency, PackageUpdate, Summary } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { applyRangeStyle, classifyDiff, pickTargetVersion } from "../utils/semver.js";
import { VersionCache } from "../cache/cache.js";
import { resolveLatestVersion } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { asyncPool } from "../utils/async-pool.js";

interface DependencyTask {
  packageDir: string;
  dependency: PackageDependency;
}

export async function check(options: CheckOptions): Promise<CheckResult> {
  const packageManager = await detectPackageManager(options.cwd);
  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  const cache = await VersionCache.create();
  const resolutionMemo = new Map<string, Promise<string | null>>();

  const updates: PackageUpdate[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalDependencies = 0;
  const tasks: DependencyTask[] = [];

  for (const packageDir of packageDirs) {
    let manifest;
    try {
      manifest = await readManifest(packageDir);
    } catch (error) {
      errors.push(`Failed to read package.json in ${packageDir}: ${String(error)}`);
      continue;
    }

    const dependencies = collectDependencies(manifest, options.includeKinds);
    totalDependencies += dependencies.length;

    for (const dep of dependencies) {
      if (!matchesPattern(dep.name, options.filter)) continue;
      if (options.reject && matchesPattern(dep.name, options.reject)) continue;
      tasks.push({ packageDir, dependency: dep });
    }
  }

  const results = await asyncPool(options.concurrency, tasks.map((task) => () => processDependency(task)));

  for (const result of results) {
    if (result instanceof Error) {
      errors.push(result.message);
      continue;
    }
    if (!result) continue;
    if (result.kind === "error") {
      errors.push(result.error);
    } else if (result.kind === "warning") {
      warnings.push(result.warning);
    } else {
      updates.push(result.update);
    }
  }

  const summary: Summary = {
    scannedPackages: packageDirs.length,
    totalDependencies,
    checkedDependencies: tasks.length,
    updatesFound: updates.length,
    upgraded: 0,
    skipped: 0,
  };

  return {
    projectPath: options.cwd,
    packagePaths: packageDirs,
    packageManager,
    target: options.target,
    timestamp: new Date().toISOString(),
    summary,
    updates,
    errors,
    warnings,
  };

  async function processDependency(task: DependencyTask): Promise<
    | { kind: "update"; update: PackageUpdate }
    | { kind: "error"; error: string }
    | { kind: "warning"; warning: string }
    | null
  > {
    const dep = task.dependency;

    try {
      const latestVersion = await getResolvedVersion(dep.name, options.target);
      if (!latestVersion) return null;

      const picked = pickTargetVersion(dep.range, latestVersion, options.target);
      if (!picked) return null;

      const nextRange = applyRangeStyle(dep.range, picked);
      if (nextRange === dep.range) return null;

      return {
        kind: "update",
        update: {
          packagePath: path.resolve(task.packageDir),
          name: dep.name,
          kind: dep.kind,
          fromRange: dep.range,
          toRange: nextRange,
          toVersionResolved: picked,
          diffType: classifyDiff(dep.range, picked),
          filtered: false,
        },
      };
    } catch (error) {
      return {
        kind: "error",
        error: `Package ${path.resolve(task.packageDir)} dependency ${dep.name}: ${String(error)}`,
      };
    }
  }

  async function getResolvedVersion(packageName: string, target: CheckOptions["target"]): Promise<string | null> {
    const memoKey = `${packageName}:${target}`;
    const memoized = resolutionMemo.get(memoKey);
    if (memoized) return memoized;

    const pending = (async () => {
      const validCached = await cache.getValid(packageName, target);
      if (validCached) {
        return validCached.latestVersion;
      }

      try {
        const latest = await resolveLatestVersion(packageName);
        if (latest) {
          await cache.set(packageName, target, latest, options.cacheTtlSeconds);
        }
        return latest;
      } catch (error) {
        const stale = await cache.getAny(packageName, target);
        if (stale) {
          return stale.latestVersion;
        }
        throw error;
      }
    })();

    resolutionMemo.set(memoKey, pending);
    return pending;
  }
}

import path from "node:path";
import type { CheckOptions, CheckResult, PackageDependency, PackageUpdate, Summary } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { applyRangeStyle, classifyDiff, clampTarget, pickTargetVersionFromAvailable } from "../utils/semver.js";
import { VersionCache } from "../cache/cache.js";
import { NpmRegistryClient } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { loadPolicy } from "../config/policy.js";

interface DependencyTask {
  packageDir: string;
  dependency: PackageDependency;
}

interface ResolvedPackageMetadata {
  latestVersion: string | null;
  availableVersions: string[];
}

export async function check(options: CheckOptions): Promise<CheckResult> {
  const packageManager = await detectPackageManager(options.cwd);
  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  const cache = await VersionCache.create();
  const registryClient = new NpmRegistryClient(options.cwd);
  const policy = await loadPolicy(options.cwd, options.policyFile);

  const updates: PackageUpdate[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  let totalDependencies = 0;
  const tasks: DependencyTask[] = [];
  let skipped = 0;

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

      const rule = policy.packageRules.get(dep.name);
      if (rule?.ignore === true) {
        skipped += 1;
        continue;
      }

      if (policy.ignorePatterns.some((pattern) => matchesPattern(dep.name, pattern))) {
        skipped += 1;
        continue;
      }

      tasks.push({ packageDir, dependency: dep });
    }
  }

  const uniquePackageNames = Array.from(new Set(tasks.map((task) => task.dependency.name)));
  const resolvedVersions = new Map<string, ResolvedPackageMetadata>();

  const unresolvedPackages: string[] = [];
  for (const packageName of uniquePackageNames) {
    const cached = await cache.getValid(packageName, options.target);
    if (cached) {
      resolvedVersions.set(packageName, {
        latestVersion: cached.latestVersion,
        availableVersions: cached.availableVersions,
      });
    } else {
      unresolvedPackages.push(packageName);
    }
  }

  if (unresolvedPackages.length > 0) {
    if (options.offline) {
      for (const packageName of unresolvedPackages) {
        const stale = await cache.getAny(packageName, options.target);
        if (stale) {
          resolvedVersions.set(packageName, {
            latestVersion: stale.latestVersion,
            availableVersions: stale.availableVersions,
          });
          warnings.push(`Using stale cache for ${packageName} because --offline is enabled.`);
        } else {
          errors.push(`Offline cache miss for ${packageName}. Run once without --offline to warm cache.`);
        }
      }
    } else {
      const fetched = await registryClient.resolveManyPackageMetadata(unresolvedPackages, {
        concurrency: options.concurrency,
      });

      for (const [packageName, metadata] of fetched.metadata) {
        resolvedVersions.set(packageName, {
          latestVersion: metadata.latestVersion,
          availableVersions: metadata.versions,
        });
        if (metadata.latestVersion) {
          await cache.set(
            packageName,
            options.target,
            metadata.latestVersion,
            metadata.versions,
            options.cacheTtlSeconds,
          );
        }
      }

      for (const [packageName, error] of fetched.errors) {
        const stale = await cache.getAny(packageName, options.target);
        if (stale) {
          resolvedVersions.set(packageName, {
            latestVersion: stale.latestVersion,
            availableVersions: stale.availableVersions,
          });
          warnings.push(`Using stale cache for ${packageName} due to registry error: ${error}`);
        } else {
          errors.push(`Unable to resolve ${packageName}: ${error}`);
        }
      }
    }
  }

  for (const task of tasks) {
    const metadata = resolvedVersions.get(task.dependency.name);
    if (!metadata?.latestVersion) continue;

    const rule = policy.packageRules.get(task.dependency.name);
    const effectiveTarget = clampTarget(options.target, rule?.maxTarget);
    const picked = pickTargetVersionFromAvailable(
      task.dependency.range,
      metadata.availableVersions,
      metadata.latestVersion,
      effectiveTarget,
    );
    if (!picked) continue;

    const nextRange = applyRangeStyle(task.dependency.range, picked);
    if (nextRange === task.dependency.range) continue;

    updates.push({
      packagePath: path.resolve(task.packageDir),
      name: task.dependency.name,
      kind: task.dependency.kind,
      fromRange: task.dependency.range,
      toRange: nextRange,
      toVersionResolved: picked,
      diffType: classifyDiff(task.dependency.range, picked),
      filtered: false,
      reason: rule?.maxTarget ? `policy maxTarget=${rule.maxTarget}` : undefined,
    });
  }

  const summary: Summary = {
    scannedPackages: packageDirs.length,
    totalDependencies,
    checkedDependencies: tasks.length,
    updatesFound: updates.length,
    upgraded: 0,
    skipped,
    warmedPackages: 0,
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
}

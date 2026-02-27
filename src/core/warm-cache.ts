import type { CheckOptions, CheckResult, Summary } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { VersionCache } from "../cache/cache.js";
import { NpmRegistryClient } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { createSummary, finalizeSummary } from "./summary.js";

export async function warmCache(options: CheckOptions): Promise<CheckResult> {
  const startedAt = Date.now();
  let discoveryMs = 0;
  let cacheMs = 0;
  let registryMs = 0;

  const discoveryStartedAt = Date.now();
  const packageManager = await detectPackageManager(options.cwd);
  const packageDirs = await discoverPackageDirs(options.cwd, options.workspace);
  discoveryMs += Date.now() - discoveryStartedAt;

  const cache = await VersionCache.create();
  const registryClient = new NpmRegistryClient(options.cwd);

  const errors: string[] = [];
  const warnings: string[] = [];

  let totalDependencies = 0;
  const packageNames = new Set<string>();

  for (const packageDir of packageDirs) {
    try {
      const manifest = await readManifest(packageDir);
      const dependencies = collectDependencies(manifest, options.includeKinds);
      totalDependencies += dependencies.length;

      for (const dep of dependencies) {
        if (!matchesPattern(dep.name, options.filter)) continue;
        if (options.reject && matchesPattern(dep.name, options.reject)) continue;
        packageNames.add(dep.name);
      }
    } catch (error) {
      errors.push(`Failed to read package.json in ${packageDir}: ${String(error)}`);
    }
  }

  const names = Array.from(packageNames);
  const needsFetch: string[] = [];

  const cacheLookupStartedAt = Date.now();
  for (const pkg of names) {
    const valid = await cache.getValid(pkg, options.target);
    if (!valid) needsFetch.push(pkg);
  }
  cacheMs += Date.now() - cacheLookupStartedAt;

  let warmed = 0;

  if (needsFetch.length > 0) {
    if (options.offline) {
      const cacheFallbackStartedAt = Date.now();
      for (const pkg of needsFetch) {
        const stale = await cache.getAny(pkg, options.target);
        if (stale) {
          warnings.push(`Using stale cache for ${pkg} in offline warm-cache mode.`);
          warmed += 1;
        } else {
          errors.push(`Offline cache miss for ${pkg}. Cannot warm cache in --offline mode.`);
        }
      }
      cacheMs += Date.now() - cacheFallbackStartedAt;
    } else {
      const registryStartedAt = Date.now();
      const fetched = await registryClient.resolveManyPackageMetadata(needsFetch, {
        concurrency: options.concurrency,
      });
      registryMs += Date.now() - registryStartedAt;

      const cacheWriteStartedAt = Date.now();
      for (const [pkg, metadata] of fetched.metadata) {
        if (metadata.latestVersion) {
          await cache.set(pkg, options.target, metadata.latestVersion, metadata.versions, options.cacheTtlSeconds);
          warmed += 1;
        }
      }
      cacheMs += Date.now() - cacheWriteStartedAt;

      for (const [pkg, error] of fetched.errors) {
        errors.push(`Unable to warm ${pkg}: ${error}`);
      }
    }
  }

  const summary: Summary = finalizeSummary(
    createSummary({
      scannedPackages: packageDirs.length,
      totalDependencies,
      checkedDependencies: names.length,
      updatesFound: 0,
      upgraded: 0,
      skipped: 0,
      warmedPackages: warmed,
      errors,
      warnings,
      durations: {
        totalMs: Date.now() - startedAt,
        discoveryMs,
        registryMs,
        cacheMs,
      },
    }),
  );

  return {
    projectPath: options.cwd,
    packagePaths: packageDirs,
    packageManager,
    target: options.target,
    timestamp: new Date().toISOString(),
    summary,
    updates: [],
    errors,
    warnings,
  };
}

import type { CheckOptions, CheckResult, Summary } from "../types/index.js";
import process from "node:process";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { VersionCache } from "../cache/cache.js";
import { NpmRegistryClient } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { createSummary, finalizeSummary } from "./summary.js";
import { formatClassifiedMessage } from "./errors.js";

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
  const registryClient = new NpmRegistryClient(options.cwd, {
    timeoutMs: options.registryTimeoutMs,
    retries: options.registryRetries,
  });

  const errors: string[] = [];
  const warnings: string[] = [];
  if (cache.degraded) {
    warnings.push(
      formatClassifiedMessage({
        code: "CACHE_BACKEND_FALLBACK",
        whatFailed: cache.fallbackReason ?? "Preferred SQLite cache backend is unavailable.",
        intact: "Warm-cache continues using the file cache backend.",
        validity: "partial",
        next: "Restore SQLite support or unset the forced file backend override if you need the preferred backend.",
      }),
    );
  }

  let totalDependencies = 0;
  const packageNames = new Set<string>();
  let streamedEvents = 0;
  const emitStream = (message: string): void => {
    if (!options.stream) return;
    streamedEvents += 1;
    process.stdout.write(`${message}\n`);
  };

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

  const names = Array.from(packageNames).sort((a, b) => a.localeCompare(b));
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
          emitStream(`[warm-cache-stale] ${pkg}`);
          warmed += 1;
        } else {
          errors.push(
            formatClassifiedMessage({
              code: "REGISTRY_ERROR",
              whatFailed: `Offline cache miss for ${pkg}.`,
              intact: "Previously cached packages remain available.",
              validity: "invalid",
              next: "Retry warm-cache without --offline.",
            }),
          );
          emitStream(`[error] Offline cache miss for ${pkg}`);
        }
      }
      cacheMs += Date.now() - cacheFallbackStartedAt;
    } else {
      const registryStartedAt = Date.now();
      const fetched = await registryClient.resolveManyPackageMetadata(needsFetch, {
        concurrency: options.concurrency,
        retries: options.registryRetries,
        timeoutMs: options.registryTimeoutMs,
      });
      registryMs += Date.now() - registryStartedAt;

      const cacheWriteStartedAt = Date.now();
      for (const [pkg, metadata] of fetched.metadata) {
        if (metadata.latestVersion) {
          await cache.set(pkg, options.target, metadata.latestVersion, metadata.versions, options.cacheTtlSeconds);
          warmed += 1;
          emitStream(`[warmed] ${pkg}@${metadata.latestVersion}`);
        }
      }
      cacheMs += Date.now() - cacheWriteStartedAt;

      for (const [pkg, error] of fetched.errors) {
        const classified = formatClassifiedMessage({
          code:
            error.includes("401") || error.includes("403")
              ? "AUTH_ERROR"
              : "REGISTRY_ERROR",
          whatFailed: `Unable to warm ${pkg}: ${error}.`,
          intact: "Any successfully warmed packages remain cached.",
          validity: "partial",
          next:
            error.includes("401") || error.includes("403")
              ? "Check registry credentials in .npmrc and retry warm-cache."
              : "Retry warm-cache or continue with stale cache if available.",
        });
        errors.push(classified);
        emitStream(`[error] ${classified}`);
      }
    }
  }

  const sortedErrors = [...errors].sort((a, b) => a.localeCompare(b));
  const sortedWarnings = [...warnings].sort((a, b) => a.localeCompare(b));

  const summary: Summary = finalizeSummary(
    createSummary({
      scannedPackages: packageDirs.length,
      totalDependencies,
      checkedDependencies: names.length,
      updatesFound: 0,
      upgraded: 0,
      skipped: 0,
      warmedPackages: warmed,
      errors: sortedErrors,
      warnings: sortedWarnings,
      durations: {
        totalMs: Date.now() - startedAt,
        discoveryMs,
        registryMs,
        cacheMs,
      },
      ciProfile: options.ciProfile,
    }),
  );
  summary.streamedEvents = streamedEvents;

  return {
    projectPath: options.cwd,
    packagePaths: packageDirs,
    packageManager,
    target: options.target,
    timestamp: new Date().toISOString(),
    summary,
    updates: [],
    errors: sortedErrors,
    warnings: sortedWarnings,
  };
}

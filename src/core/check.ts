import path from "node:path";
import process from "node:process";
import type { CheckOptions, CheckResult, PackageDependency, PackageUpdate, Summary } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { applyRangeStyle, classifyDiff, clampTarget, pickTargetVersionFromAvailable } from "../utils/semver.js";
import { VersionCache } from "../cache/cache.js";
import { NpmRegistryClient } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";
import { discoverPackageDirs } from "../workspace/discover.js";
import { loadPolicy, resolvePolicyRule } from "../config/policy.js";
import { createSummary, finalizeSummary } from "./summary.js";

interface DependencyTask {
  packageDir: string;
  dependency: PackageDependency;
}

interface ResolvedPackageMetadata {
  latestVersion: string | null;
  availableVersions: string[];
  publishedAtByVersion: Record<string, number>;
}

export async function check(options: CheckOptions): Promise<CheckResult> {
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
  const policy = await loadPolicy(options.cwd, options.policyFile);

  const updates: PackageUpdate[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (cache.degraded) {
    warnings.push("SQLite cache backend unavailable in Bun runtime. Falling back to file cache backend.");
  }

  let totalDependencies = 0;
  const tasks: DependencyTask[] = [];
  let skipped = 0;
  let cooldownSkipped = 0;
  let streamedEvents = 0;
  let policyOverridesApplied = 0;

  const emitStream = (message: string): void => {
    if (!options.stream) return;
    streamedEvents += 1;
    process.stdout.write(`${message}\n`);
  };

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

      const rule = resolvePolicyRule(dep.name, policy);
      if (rule?.ignore === true) {
        skipped += 1;
        policyOverridesApplied += 1;
        emitStream(`[policy-ignore] ${dep.name}`);
        continue;
      }

      if (policy.ignorePatterns.some((pattern) => matchesPattern(dep.name, pattern))) {
        skipped += 1;
        policyOverridesApplied += 1;
        emitStream(`[policy-ignore-pattern] ${dep.name}`);
        continue;
      }

      tasks.push({ packageDir, dependency: dep });
    }
  }

  const uniquePackageNames = Array.from(new Set(tasks.map((task) => task.dependency.name))).sort((a, b) =>
    a.localeCompare(b),
  );
  const resolvedVersions = new Map<string, ResolvedPackageMetadata>();

  const unresolvedPackages: string[] = [];
  const cacheLookupStartedAt = Date.now();
  for (const packageName of uniquePackageNames) {
    const cached = await cache.getValid(packageName, options.target);
    if (cached) {
      resolvedVersions.set(packageName, {
        latestVersion: cached.latestVersion,
        availableVersions: cached.availableVersions,
        publishedAtByVersion: {},
      });
    } else {
      unresolvedPackages.push(packageName);
    }
  }
  cacheMs += Date.now() - cacheLookupStartedAt;

  if (unresolvedPackages.length > 0) {
    if (options.offline) {
      const cacheFallbackStartedAt = Date.now();
      for (const packageName of unresolvedPackages) {
        const stale = await cache.getAny(packageName, options.target);
        if (stale) {
          resolvedVersions.set(packageName, {
            latestVersion: stale.latestVersion,
            availableVersions: stale.availableVersions,
            publishedAtByVersion: {},
          });
          warnings.push(`Using stale cache for ${packageName} because --offline is enabled.`);
        } else {
          errors.push(`Offline cache miss for ${packageName}. Run once without --offline to warm cache.`);
        }
      }
      cacheMs += Date.now() - cacheFallbackStartedAt;
    } else {
      const registryStartedAt = Date.now();
      const fetched = await registryClient.resolveManyPackageMetadata(unresolvedPackages, {
        concurrency: options.concurrency,
        retries: options.registryRetries,
        timeoutMs: options.registryTimeoutMs,
      });
      registryMs += Date.now() - registryStartedAt;

      const cacheWriteStartedAt = Date.now();
      for (const [packageName, metadata] of fetched.metadata) {
        resolvedVersions.set(packageName, {
          latestVersion: metadata.latestVersion,
          availableVersions: metadata.versions,
          publishedAtByVersion: metadata.publishedAtByVersion,
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
      cacheMs += Date.now() - cacheWriteStartedAt;

      const cacheStaleStartedAt = Date.now();
      for (const [packageName, error] of fetched.errors) {
        const stale = await cache.getAny(packageName, options.target);
        if (stale) {
          resolvedVersions.set(packageName, {
            latestVersion: stale.latestVersion,
            availableVersions: stale.availableVersions,
            publishedAtByVersion: {},
          });
          warnings.push(`Using stale cache for ${packageName} due to registry error: ${error}`);
        } else {
          errors.push(`Unable to resolve ${packageName}: ${error}`);
          emitStream(`[error] Unable to resolve ${packageName}: ${error}`);
        }
      }
      cacheMs += Date.now() - cacheStaleStartedAt;
    }
  }

  for (const task of tasks) {
    const metadata = resolvedVersions.get(task.dependency.name);
    if (!metadata?.latestVersion) continue;

    const rule = resolvePolicyRule(task.dependency.name, policy);
    const baseTarget = rule?.target ?? options.target;
    const effectiveTarget = clampTarget(baseTarget, rule?.maxTarget);
    if (rule?.target || rule?.maxTarget || rule?.autofix === false) {
      policyOverridesApplied += 1;
    }
    const picked = pickTargetVersionFromAvailable(
      task.dependency.range,
      metadata.availableVersions,
      metadata.latestVersion,
      effectiveTarget,
    );
    if (!picked) continue;
    if (shouldSkipByCooldown(picked, metadata.publishedAtByVersion, options.cooldownDays, policy.cooldownDays, rule?.cooldownDays)) {
      cooldownSkipped += 1;
      emitStream(`[cooldown-skip] ${task.dependency.name}@${picked}`);
      continue;
    }

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
      autofix: rule?.autofix !== false,
      reason: rule?.maxTarget ? `policy maxTarget=${rule.maxTarget}` : undefined,
    });
    emitStream(
      `[update] ${task.dependency.name} ${task.dependency.range} -> ${nextRange} (${classifyDiff(task.dependency.range, picked)})`,
    );
  }

  const grouped = groupUpdates(updates, options.groupBy);
  const groupedUpdates = grouped.length;
  const groupedSorted = sortUpdates(grouped.flatMap((group) => group.items));
  const groupedCapped = typeof options.groupMax === "number" ? groupedSorted.slice(0, options.groupMax) : groupedSorted;
  const prioritized = applyPolicyPrioritySort(groupedCapped, policy);
  const ruleLimited = applyRuleUpdateCaps(prioritized, policy);
  const prLimited = typeof options.prLimit === "number" ? ruleLimited.slice(0, options.prLimit) : ruleLimited;
  const limitedUpdates = sortUpdates(prLimited);
  const prLimitHit = typeof options.prLimit === "number" && groupedSorted.length > options.prLimit;
  const sortedErrors = [...errors].sort((a, b) => a.localeCompare(b));
  const sortedWarnings = [...warnings].sort((a, b) => a.localeCompare(b));
  const summary: Summary = finalizeSummary(
    createSummary({
      scannedPackages: packageDirs.length,
      totalDependencies,
      checkedDependencies: tasks.length,
      updatesFound: limitedUpdates.length,
      upgraded: 0,
      skipped,
      warmedPackages: 0,
      errors: sortedErrors,
      warnings: sortedWarnings,
      durations: {
        totalMs: Date.now() - startedAt,
        discoveryMs,
        registryMs,
        cacheMs,
      },
      groupedUpdates,
      cooldownSkipped,
      ciProfile: options.ciProfile,
      prLimitHit,
      policyOverridesApplied,
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
    updates: limitedUpdates,
    errors: sortedErrors,
    warnings: sortedWarnings,
  };
}

interface UpdateGroup {
  key: string;
  items: PackageUpdate[];
}

function groupUpdates(updates: PackageUpdate[], groupBy: CheckOptions["groupBy"]): UpdateGroup[] {
  if (updates.length === 0) {
    return [];
  }
  if (groupBy === "none") {
    return [{ key: "all", items: [...updates] }];
  }

  const byGroup = new Map<string, PackageUpdate[]>();
  for (const update of updates) {
    const key = groupKey(update, groupBy);
    const current = byGroup.get(key) ?? [];
    current.push(update);
    byGroup.set(key, current);
  }
  return Array.from(byGroup.entries())
    .map(([key, items]) => ({ key, items: sortUpdates(items) }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function groupKey(update: PackageUpdate, groupBy: CheckOptions["groupBy"]): string {
  if (groupBy === "name") return update.name;
  if (groupBy === "kind") return update.kind;
  if (groupBy === "risk") return update.diffType;
  if (groupBy === "scope") {
    if (update.name.startsWith("@")) {
      const slash = update.name.indexOf("/");
      if (slash > 1) return update.name.slice(0, slash);
    }
    return "unscoped";
  }
  return "all";
}

function shouldSkipByCooldown(
  pickedVersion: string,
  publishedAtByVersion: Record<string, number>,
  optionCooldownDays: number | undefined,
  policyCooldownDays: number | undefined,
  ruleCooldownDays: number | undefined,
): boolean {
  const cooldownDays = ruleCooldownDays ?? optionCooldownDays ?? policyCooldownDays;
  if (typeof cooldownDays !== "number" || cooldownDays <= 0) return false;
  const publishedAt = publishedAtByVersion[pickedVersion];
  if (typeof publishedAt !== "number" || !Number.isFinite(publishedAt)) return false;
  const threshold = Date.now() - cooldownDays * 24 * 60 * 60 * 1000;
  return publishedAt > threshold;
}

function applyRuleUpdateCaps(updates: PackageUpdate[], policy: Awaited<ReturnType<typeof loadPolicy>>): PackageUpdate[] {
  const limited: PackageUpdate[] = [];
  const seenPerPackage = new Map<string, number>();

  for (const update of updates) {
    const rule = resolvePolicyRule(update.name, policy);
    const cap = rule?.maxUpdatesPerRun;
    if (typeof cap !== "number") {
      limited.push(update);
      continue;
    }
    const seen = seenPerPackage.get(update.name) ?? 0;
    if (seen >= cap) {
      continue;
    }
    seenPerPackage.set(update.name, seen + 1);
    limited.push(update);
  }

  return limited;
}

function applyPolicyPrioritySort(
  updates: PackageUpdate[],
  policy: Awaited<ReturnType<typeof loadPolicy>>,
): PackageUpdate[] {
  return [...updates].sort((left, right) => {
    const leftPriority = resolvePolicyRule(left.name, policy)?.priority ?? 0;
    const rightPriority = resolvePolicyRule(right.name, policy)?.priority ?? 0;
    if (leftPriority !== rightPriority) return rightPriority - leftPriority;
    const byRisk = riskRank(left.diffType) - riskRank(right.diffType);
    if (byRisk !== 0) return byRisk;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.packagePath.localeCompare(right.packagePath);
  });
}

function riskRank(value: PackageUpdate["diffType"]): number {
  if (value === "patch") return 0;
  if (value === "minor") return 1;
  if (value === "major") return 2;
  return 3;
}

function sortUpdates(updates: PackageUpdate[]): PackageUpdate[] {
  return [...updates].sort((left, right) => {
    const byPath = left.packagePath.localeCompare(right.packagePath);
    if (byPath !== 0) return byPath;
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    const byKind = left.kind.localeCompare(right.kind);
    if (byKind !== 0) return byKind;
    const byFrom = left.fromRange.localeCompare(right.fromRange);
    if (byFrom !== 0) return byFrom;
    return left.toRange.localeCompare(right.toRange);
  });
}

import type { CheckOptions, CheckResult, PackageUpdate, Summary } from "../types/index.js";
import { collectDependencies, readManifest } from "../parsers/package-json.js";
import { matchesPattern } from "../utils/pattern.js";
import { applyRangeStyle, classifyDiff, pickTargetVersion } from "../utils/semver.js";
import { VersionCache } from "../cache/cache.js";
import { resolveLatestVersion } from "../registry/npm.js";
import { detectPackageManager } from "../pm/detect.js";

export async function check(options: CheckOptions): Promise<CheckResult> {
  const manifest = await readManifest(options.cwd);
  const packageManager = await detectPackageManager(options.cwd);
  const dependencies = collectDependencies(manifest, options.includeKinds);
  const cache = await VersionCache.create();

  const updates: PackageUpdate[] = [];
  const errors: string[] = [];

  for (const dep of dependencies) {
    if (!matchesPattern(dep.name, options.filter)) continue;
    if (options.reject && matchesPattern(dep.name, options.reject)) continue;

    try {
      const cached = await cache.getValid(dep.name, options.target);
      const latestVersion = cached?.latestVersion ?? (await resolveLatestVersion(dep.name));
      if (!latestVersion) continue;

      if (!cached) {
        await cache.set(dep.name, options.target, latestVersion, options.cacheTtlSeconds);
      }

      const picked = pickTargetVersion(dep.range, latestVersion, options.target);
      if (!picked) continue;

      const nextRange = applyRangeStyle(dep.range, picked);
      if (nextRange === dep.range) continue;

      updates.push({
        name: dep.name,
        kind: dep.kind,
        fromRange: dep.range,
        toRange: nextRange,
        toVersionResolved: picked,
        diffType: classifyDiff(dep.range, picked),
        filtered: false,
      });
    } catch (error) {
      errors.push(`Dependency ${dep.name}: ${String(error)}`);
    }
  }

  const summary: Summary = {
    totalDependencies: dependencies.length,
    checkedDependencies: dependencies.filter(
      (dep) => matchesPattern(dep.name, options.filter) && !(options.reject && matchesPattern(dep.name, options.reject)),
    ).length,
    updatesFound: updates.length,
    upgraded: 0,
    skipped: 0,
  };

  return {
    projectPath: options.cwd,
    packageManager,
    target: options.target,
    timestamp: new Date().toISOString(),
    summary,
    updates,
    errors,
  };
}

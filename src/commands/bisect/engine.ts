import { NpmRegistryClient } from "../../registry/npm.js";
import { VersionCache } from "../../cache/cache.js";
import type {
  BisectOptions,
  BisectOutcome,
  BisectResult,
} from "../../types/index.js";
import { bisectOracle } from "./oracle.js";

/**
 * Binary search engine for dependency bisecting.
 * Given a sorted list of versions, finds the exact version that causes
 * a test oracle to switch from "good" → "bad".
 */
export async function bisectVersions(
  versions: string[],
  options: BisectOptions,
): Promise<BisectResult> {
  const result: BisectResult = {
    packageName: options.packageName,
    breakingVersion: null,
    lastGoodVersion: null,
    totalVersionsTested: 0,
    iterations: 0,
  };

  if (versions.length === 0) {
    return result;
  }

  let lo = 0;
  let hi = versions.length - 1;

  // Verify boundaries: hi must be "bad", lo must be "good"
  const hiOutcome = await bisectOracle(
    options.packageName,
    versions[hi],
    options,
  );
  result.totalVersionsTested += 1;
  result.iterations += 1;

  if (hiOutcome !== "bad") {
    // Latest version is good — nothing to bisect
    return result;
  }

  const loOutcome = await bisectOracle(
    options.packageName,
    versions[lo],
    options,
  );
  result.totalVersionsTested += 1;
  result.iterations += 1;

  if (loOutcome === "bad") {
    // Even the first version fails — can't determine boundary
    result.breakingVersion = versions[lo];
    return result;
  }

  // Binary search
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const outcome: BisectOutcome = await bisectOracle(
      options.packageName,
      versions[mid],
      options,
    );
    result.totalVersionsTested += 1;
    result.iterations += 1;

    if (outcome === "bad") {
      hi = mid;
    } else if (outcome === "good") {
      lo = mid;
    } else {
      // "skip" — skip this version and go toward bad side
      hi = mid - 1;
    }
  }

  result.lastGoodVersion = versions[lo];
  result.breakingVersion = versions[hi];
  return result;
}

/**
 * Fetches available versions for a package from registry/cache,
 * optionally filtered to a user-specified range, sorted ascending.
 */
export async function fetchBisectVersions(
  options: BisectOptions,
): Promise<string[]> {
  const cache = await VersionCache.create();
  const registry = new NpmRegistryClient(options.cwd, {
    timeoutMs: options.registryTimeoutMs,
    retries: 2,
  });

  const cached = await cache.getAny(options.packageName, "latest");
  let allVersions: string[] = cached?.availableVersions ?? [];

  if (allVersions.length === 0) {
    const result = await registry.resolveManyPackageMetadata(
      [options.packageName],
      {
        concurrency: 1,
        retries: 2,
        timeoutMs: options.registryTimeoutMs,
      },
    );
    const meta = result.metadata.get(options.packageName);
    allVersions = meta?.versions ?? [];
  }

  if (options.versionRange) {
    const [rangeStart, rangeEnd] = options.versionRange.split("..");
    allVersions = allVersions.filter((v) => {
      const afterStart = !rangeStart || v >= rangeStart;
      const beforeEnd = !rangeEnd || v <= rangeEnd;
      return afterStart && beforeEnd;
    });
  }

  return allVersions.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );
}

import type { FailOnLevel, FailReason, PackageUpdate, Summary } from "../types/index.js";

export interface DurationInput {
  totalMs: number;
  discoveryMs: number;
  registryMs: number;
  cacheMs: number;
}

export function createSummary(input: {
  scannedPackages: number;
  totalDependencies: number;
  checkedDependencies: number;
  updatesFound: number;
  upgraded: number;
  skipped: number;
  warmedPackages: number;
  errors: string[];
  warnings: string[];
  durations: DurationInput;
}): Summary {
  return {
    contractVersion: "2",
    scannedPackages: input.scannedPackages,
    totalDependencies: input.totalDependencies,
    checkedDependencies: input.checkedDependencies,
    updatesFound: input.updatesFound,
    upgraded: input.upgraded,
    skipped: input.skipped,
    warmedPackages: input.warmedPackages,
    failReason: "none",
    errorCounts: {
      total: input.errors.length,
      offlineCacheMiss: countPattern(input.errors, "Offline cache miss"),
      registryFailure: countPattern(input.errors, "Unable to resolve"),
      other: 0,
    },
    warningCounts: {
      total: input.warnings.length,
      staleCache: countPattern(input.warnings, "Using stale cache"),
      other: 0,
    },
    durationMs: {
      total: Math.max(0, Math.round(input.durations.totalMs)),
      discovery: Math.max(0, Math.round(input.durations.discoveryMs)),
      registry: Math.max(0, Math.round(input.durations.registryMs)),
      cache: Math.max(0, Math.round(input.durations.cacheMs)),
      render: 0,
    },
  };
}

export function finalizeSummary(summary: Summary): Summary {
  const errorOther = summary.errorCounts.total - summary.errorCounts.offlineCacheMiss - summary.errorCounts.registryFailure;
  const warningOther = summary.warningCounts.total - summary.warningCounts.staleCache;
  summary.errorCounts.other = Math.max(0, errorOther);
  summary.warningCounts.other = Math.max(0, warningOther);
  return summary;
}

export function resolveFailReason(
  updates: PackageUpdate[],
  errors: string[],
  failOn: FailOnLevel | undefined,
  maxUpdates: number | undefined,
  ciMode: boolean,
): FailReason {
  if (errors.some((error) => error.includes("Offline cache miss"))) {
    return "offline-cache-miss";
  }
  if (errors.some((error) => error.includes("Unable to resolve"))) {
    return "registry-failure";
  }
  if (typeof maxUpdates === "number" && updates.length > maxUpdates) {
    return "updates-threshold";
  }
  const effectiveFailOn: FailOnLevel = failOn && failOn !== "none" ? failOn : ciMode ? "any" : "none";
  if (shouldFailForUpdates(updates, effectiveFailOn)) {
    return "severity-threshold";
  }
  return "none";
}

export function shouldFailForUpdates(updates: PackageUpdate[], failOn: FailOnLevel): boolean {
  if (failOn === "none") return false;
  if (failOn === "any" || failOn === "patch") return updates.length > 0;
  if (failOn === "minor") return updates.some((update) => update.diffType === "minor" || update.diffType === "major");
  return updates.some((update) => update.diffType === "major");
}

function countPattern(values: string[], token: string): number {
  return values.filter((value) => value.includes(token)).length;
}

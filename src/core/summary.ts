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
  const offlineCacheMiss = input.errors.filter((error) => isOfflineCacheMissError(error)).length;
  const registryFailure = input.errors.filter((error) => isRegistryFailureError(error)).length;
  const staleCache = input.warnings.filter((warning) => warning.includes("Using stale cache")).length;

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
      offlineCacheMiss,
      registryFailure,
      other: 0,
    },
    warningCounts: {
      total: input.warnings.length,
      staleCache,
      other: 0,
    },
    durationMs: {
      total: Math.max(0, Math.round(input.durations.totalMs)),
      discovery: Math.max(0, Math.round(input.durations.discoveryMs)),
      registry: Math.max(0, Math.round(input.durations.registryMs)),
      cache: Math.max(0, Math.round(input.durations.cacheMs)),
      render: 0,
    },
    fixPrApplied: false,
    fixBranchName: "",
    fixCommitSha: "",
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
  if (errors.some((error) => isOfflineCacheMissError(error))) {
    return "offline-cache-miss";
  }
  if (errors.some((error) => isRegistryFailureError(error))) {
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

function isOfflineCacheMissError(value: string): boolean {
  return value.includes("Offline cache miss");
}

function isRegistryFailureError(value: string): boolean {
  return (
    value.includes("Unable to resolve") ||
    value.includes("Unable to warm") ||
    value.includes("Registry request failed") ||
    value.includes("Registry temporary error")
  );
}

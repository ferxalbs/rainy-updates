import type { FailOnLevel, FailReason, PackageUpdate, Summary } from "../types/index.js";
import { hasErrorCode } from "./errors.js";

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
  groupedUpdates?: number;
  cooldownSkipped?: number;
  ciProfile?: Summary["ciProfile"];
  prLimitHit?: boolean;
  policyOverridesApplied?: number;
}): Summary {
  const offlineCacheMiss = input.errors.filter((error) => isOfflineCacheMissError(error)).length;
  const registryFailure = input.errors.filter((error) => isRegistryFailureError(error)).length;
  const registryAuthFailure = input.errors.filter((error) => isRegistryAuthError(error)).length;
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
      registryAuthFailure,
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
    fixPrBranchesCreated: 0,
    groupedUpdates: Math.max(0, Math.round(input.groupedUpdates ?? 0)),
    cooldownSkipped: Math.max(0, Math.round(input.cooldownSkipped ?? 0)),
    ciProfile: input.ciProfile ?? "minimal",
    prLimitHit: input.prLimitHit === true,
    streamedEvents: 0,
    policyOverridesApplied: Math.max(0, Math.round(input.policyOverridesApplied ?? 0)),
    verdict: undefined,
    interactiveSession: false,
    riskPackages: 0,
    securityPackages: 0,
    peerConflictPackages: 0,
    licenseViolationPackages: 0,
    privateRegistryPackages: 0,
    runId: undefined,
    artifactManifest: undefined,
    policyActionCounts: undefined,
    blockedPackages: 0,
    reviewPackages: 0,
    monitorPackages: 0,
    decisionPackages: 0,
    releaseVolatilityPackages: 0,
    engineConflictPackages: 0,
    degradedSources: [],
    cacheBackend: undefined,
    binaryRecommended: false,
    gaReady: undefined,
    dependencyHealthScore: undefined,
    findingCountsByCategory: undefined,
    findingCountsBySeverity: undefined,
    primaryFindingCode: undefined,
    primaryFindingCategory: undefined,
    nextActionReason: undefined,
    suggestedCommand: undefined,
    decisionPlan: undefined,
    interactiveSurface: undefined,
    queueFocus: undefined,
    verificationState: undefined,
    verificationFailures: undefined,
  };
}

export function finalizeSummary(summary: Summary): Summary {
  const errorOther =
    summary.errorCounts.total -
    summary.errorCounts.offlineCacheMiss -
    summary.errorCounts.registryFailure -
    summary.errorCounts.registryAuthFailure;
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
    hasErrorCode(value, "REGISTRY_ERROR") ||
    value.includes("Unable to resolve") ||
    value.includes("Unable to warm") ||
    value.includes("Registry request failed") ||
    value.includes("Registry temporary error")
  );
}

function isRegistryAuthError(value: string): boolean {
  return hasErrorCode(value, "AUTH_ERROR") || value.includes("Registry authentication failed") || value.includes("401");
}

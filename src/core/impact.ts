import type {
  ImpactScore,
  PackageUpdate,
  TargetLevel,
} from "../types/index.js";

/**
 * Context fed into the impact scorer from the outer check/upgrade pipeline.
 * All fields are optional — missing data degrades gracefully.
 */
export interface ImpactContext {
  /** Names of packages that have a known CVE advisory (from `rup audit` cache). */
  advisoryPackages?: ReadonlySet<string>;
  /** How many workspace packages depend on this package (reverse-dep count). */
  workspaceDependentCount?: (name: string) => number;
}

/** Weights for each semver diff type. */
const DIFF_WEIGHT: Record<TargetLevel, number> = {
  patch: 10,
  minor: 25,
  major: 55,
  latest: 30,
};

/** Advisory presence bonus — lifts total score significantly. */
const ADVISORY_BONUS = 35;

/** Points added per additional workspace package that uses this dep. */
const WORKSPACE_SPREAD_PER_PKG = 5;

/** Maximum workspace spread contribution (cap). */
const WORKSPACE_SPREAD_CAP = 20;

/**
 * Compute an `ImpactScore` for a single pending package update.
 *
 * Algorithm:
 *   score = diffWeight
 *         + (advisoryBonus if CVE exists)
 *         + min(workspaceCount × perPkg, cap)
 *
 * Clamped to [0, 100]. Rank thresholds:
 *   ≥ 70 → critical
 *   ≥ 45 → high
 *   ≥ 20 → medium
 *   <  20 → low
 */
export function computeImpactScore(
  update: PackageUpdate,
  context: ImpactContext = {},
): ImpactScore {
  const diffTypeWeight = DIFF_WEIGHT[update.diffType] ?? DIFF_WEIGHT.latest;
  const hasAdvisory = context.advisoryPackages?.has(update.name) ?? false;
  const rawWorkspaceCount = context.workspaceDependentCount?.(update.name) ?? 0;
  const affectedWorkspaceCount = Math.max(0, rawWorkspaceCount);

  const advisoryPoints = hasAdvisory ? ADVISORY_BONUS : 0;
  const workspacePoints = Math.min(
    affectedWorkspaceCount * WORKSPACE_SPREAD_PER_PKG,
    WORKSPACE_SPREAD_CAP,
  );

  const rawScore = diffTypeWeight + advisoryPoints + workspacePoints;
  const score = Math.min(100, Math.max(0, rawScore));

  const rank = scoreToRank(score);

  return {
    rank,
    score,
    factors: {
      diffTypeWeight,
      hasAdvisory,
      affectedWorkspaceCount,
    },
  };
}

/**
 * Batch-compute impact scores for all updates, returning a new array with
 * `impactScore` populated on each entry. Non-mutating.
 */
export function applyImpactScores(
  updates: PackageUpdate[],
  context: ImpactContext = {},
): PackageUpdate[] {
  return updates.map((u) => ({
    ...u,
    impactScore: computeImpactScore(u, context),
  }));
}

function scoreToRank(score: number): ImpactScore["rank"] {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "medium";
  return "low";
}

/**
 * Returns the ANSI color badge string for terminal output.
 * Used by the table renderer when --show-impact is active.
 */
export function impactBadge(score: ImpactScore): string {
  switch (score.rank) {
    case "critical":
      return "\x1b[41m\x1b[97m CRITICAL \x1b[0m";
    case "high":
      return "\x1b[31m HIGH \x1b[0m";
    case "medium":
      return "\x1b[33m MED  \x1b[0m";
    case "low":
      return "\x1b[32m LOW  \x1b[0m";
  }
}

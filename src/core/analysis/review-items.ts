import { fetchChangelog } from "../../commands/changelog/fetcher.js";
import { applyRiskAssessments } from "../../risk/index.js";
import { applyImpactScores } from "../impact.js";
import type {
  AnalysisBundle,
  AuditResult,
  PackageUpdate,
  ReleaseNotesSummary,
  ResolveResult,
  ReviewItem,
  UnusedResult,
} from "../../types/index.js";

export async function buildReviewItems(
  updates: PackageUpdate[],
  auditResult: AuditResult,
  resolveResult: ResolveResult,
  healthResult: AnalysisBundle["health"],
  licenseResult: AnalysisBundle["licenses"],
  unusedResult: UnusedResult,
  config: { includeChangelog?: boolean },
): Promise<ReviewItem[]> {
  const advisoryPackages = new Set(auditResult.packages.map((pkg) => pkg.packageName));
  const impactedUpdates = applyImpactScores(updates, {
    advisoryPackages,
    workspaceDependentCount: (name) => updates.filter((item) => item.name === name).length,
  });
  const healthByName = new Map(healthResult.metrics.map((metric) => [metric.name, metric]));
  const advisoriesByName = new Map<string, AuditResult["advisories"]>();
  const conflictsByName = new Map<string, ResolveResult["conflicts"]>();
  const licenseByName = new Map(licenseResult.packages.map((pkg) => [pkg.name, pkg]));
  const licenseViolationNames = new Set(licenseResult.violations.map((pkg) => pkg.name));
  const unusedByName = new Map<string, UnusedResult["unused"]>();

  for (const advisory of auditResult.advisories) {
    const list = advisoriesByName.get(advisory.packageName) ?? [];
    list.push(advisory);
    advisoriesByName.set(advisory.packageName, list);
  }
  for (const conflict of resolveResult.conflicts) {
    const list = conflictsByName.get(conflict.requester) ?? [];
    list.push(conflict);
    conflictsByName.set(conflict.requester, list);
    const peerList = conflictsByName.get(conflict.peer) ?? [];
    peerList.push(conflict);
    conflictsByName.set(conflict.peer, peerList);
  }
  for (const issue of [...unusedResult.unused, ...unusedResult.missing]) {
    const list = unusedByName.get(issue.name) ?? [];
    list.push(issue);
    unusedByName.set(issue.name, list);
  }

  const enrichedUpdates = await maybeAttachReleaseNotes(
    impactedUpdates,
    Boolean(config.includeChangelog),
  );

  return applyRiskAssessments(
    enrichedUpdates.map((update) =>
      enrichUpdate(
        update,
        advisoriesByName,
        conflictsByName,
        healthByName,
        licenseByName,
        licenseViolationNames,
        unusedByName,
      ),
    ),
    {
      knownPackageNames: new Set(updates.map((item) => item.name)),
    },
  ).map((item) => ({
    ...item,
    update: {
      ...item.update,
      policyAction: derivePolicyAction(item),
      decisionState: deriveDecisionState(item),
      selectedByDefault: deriveDecisionState(item) !== "blocked",
      blockedReason:
        deriveDecisionState(item) === "blocked"
          ? item.update.recommendedAction
          : undefined,
      monitorReason:
        item.update.healthStatus === "stale" ? "Package health should be monitored." : undefined,
    },
  }));
}

function enrichUpdate(
  update: PackageUpdate,
  advisoriesByName: Map<string, AuditResult["advisories"]>,
  conflictsByName: Map<string, ResolveResult["conflicts"]>,
  healthByName: Map<string, AnalysisBundle["health"]["metrics"][number]>,
  licenseByName: Map<string, AnalysisBundle["licenses"]["packages"][number]>,
  licenseViolationNames: Set<string>,
  unusedByName: Map<string, UnusedResult["unused"]>,
): ReviewItem {
  const advisories = advisoriesByName.get(update.name) ?? [];
  const peerConflicts = conflictsByName.get(update.name) ?? [];
  const health = healthByName.get(update.name);
  const license = licenseByName.get(update.name);
  const unusedIssues = unusedByName.get(update.name) ?? [];
  return {
    update: {
      ...update,
      advisoryCount: advisories.length,
      peerConflictSeverity: peerConflicts.some((item) => item.severity === "error")
        ? "error"
        : peerConflicts.length > 0
          ? "warning"
          : "none",
      licenseStatus: licenseViolationNames.has(update.name)
        ? "denied"
        : license
          ? "allowed"
          : "review",
      healthStatus: health?.flags[0] ?? "healthy",
    },
    advisories,
    health,
    peerConflicts,
    license,
    unusedIssues,
    selected: true,
  };
}

function derivePolicyAction(item: ReviewItem): PackageUpdate["policyAction"] {
  if (item.update.peerConflictSeverity === "error" || item.update.licenseStatus === "denied") {
    return "block";
  }
  if ((item.update.advisoryCount ?? 0) > 0 || item.update.riskLevel === "critical") {
    return "review";
  }
  if (item.update.healthStatus === "stale" || item.update.healthStatus === "archived") {
    return "monitor";
  }
  return "allow";
}

function deriveDecisionState(item: ReviewItem): PackageUpdate["decisionState"] {
  if (item.update.peerConflictSeverity === "error" || item.update.licenseStatus === "denied") {
    return "blocked";
  }
  if ((item.update.advisoryCount ?? 0) > 0 || item.update.riskLevel === "critical") {
    return "actionable";
  }
  if (item.update.riskLevel === "high" || item.update.diffType === "major") {
    return "review";
  }
  return "safe";
}

async function maybeAttachReleaseNotes(
  updates: PackageUpdate[],
  includeChangelog: boolean,
): Promise<PackageUpdate[]> {
  if (!includeChangelog || updates.length === 0) {
    return updates;
  }
  return Promise.all(
    updates.map(async (update) => ({
      ...update,
      releaseNotesSummary: summarizeChangelog(
        await fetchChangelog(update.name, update.repository),
      ),
    })),
  );
}

function summarizeChangelog(content: string | null): ReleaseNotesSummary | undefined {
  if (!content) return undefined;
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.startsWith("#"))?.replace(/^#+\s*/, "") ?? "Release notes";
  const excerpt = lines.find((line) => !line.startsWith("#")) ?? "No summary available.";
  return {
    source: content.includes("# Release") ? "github-release" : "changelog-file",
    title,
    excerpt: excerpt.slice(0, 240),
  };
}

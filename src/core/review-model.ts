import path from "node:path";
import { createSummary, finalizeSummary } from "./summary.js";
import type {
  CheckOptions,
  DoctorOptions,
  ReviewItem,
  ReviewOptions,
  ReviewResult,
  Summary,
} from "../types/index.js";
import { buildAnalysisBundle } from "./analysis-bundle.js";
export { createDoctorResult } from "./doctor/result.js";
export {
  renderDoctorAgentReport,
  renderDoctorResult,
} from "./doctor/render.js";
import { deriveReviewVerdict } from "./review-verdict.js";

export async function buildReviewResult(
  options: ReviewOptions | DoctorOptions | CheckOptions,
): Promise<ReviewResult> {
  const includeChangelog =
    ("showChangelog" in options && options.showChangelog === true) ||
    ("includeChangelog" in options && options.includeChangelog === true) ||
    options.interactive === true;
  const analysis = await buildAnalysisBundle(options, { includeChangelog });
  const items = analysis.items.filter((item) => matchesReviewFilters(item, options));
  const checkResult = analysis.check;

  const summary = createReviewSummary(
    checkResult.summary,
    items,
    [
      ...checkResult.errors,
      ...analysis.audit.errors,
      ...analysis.resolve.errors,
      ...analysis.health.errors,
      ...analysis.licenses.errors,
      ...analysis.unused.errors,
    ],
    [
      ...checkResult.warnings,
      ...analysis.audit.warnings,
      ...analysis.resolve.warnings,
      ...analysis.health.warnings,
      ...analysis.licenses.warnings,
      ...analysis.unused.warnings,
    ],
    options.interactive === true,
    analysis.degradedSources,
  );

  return {
    projectPath: checkResult.projectPath,
    target: checkResult.target,
    summary,
    analysis,
    items,
    updates: items.map((item) => item.update),
    errors: [
      ...checkResult.errors,
      ...analysis.audit.errors,
      ...analysis.resolve.errors,
      ...analysis.health.errors,
      ...analysis.licenses.errors,
      ...analysis.unused.errors,
    ],
    warnings: [
      ...checkResult.warnings,
      ...analysis.audit.warnings,
      ...analysis.resolve.warnings,
      ...analysis.health.warnings,
      ...analysis.licenses.warnings,
      ...analysis.unused.warnings,
    ],
  };
}

export function renderReviewResult(review: ReviewResult): string {
  const lines: string[] = [];
  lines.push(`Project: ${review.projectPath}`);
  lines.push(`Target: ${review.target}`);
  lines.push(`Verdict: ${review.summary.verdict ?? "safe"}`);
  lines.push("");
  if (review.items.length === 0) {
    lines.push("No reviewable updates found.");
  } else {
    lines.push("Updates:");
    for (const item of review.items) {
      const notes = [
        item.update.diffType,
        item.update.riskLevel ? `risk=${item.update.riskLevel}` : undefined,
        typeof item.update.riskScore === "number"
          ? `score=${item.update.riskScore}`
          : undefined,
        item.update.advisoryCount ? `security=${item.update.advisoryCount}` : undefined,
        item.update.peerConflictSeverity && item.update.peerConflictSeverity !== "none"
          ? `peer=${item.update.peerConflictSeverity}`
          : undefined,
        item.update.licenseStatus && item.update.licenseStatus !== "allowed"
          ? `license=${item.update.licenseStatus}`
          : undefined,
        item.update.policyAction ? `policy=${item.update.policyAction}` : undefined,
      ].filter(Boolean);
      lines.push(
        `- ${path.basename(item.update.packagePath)} :: ${item.update.name} ${item.update.fromRange} -> ${item.update.toRange} (${notes.join(", ")})`,
      );
      if (item.update.riskReasons && item.update.riskReasons.length > 0) {
        lines.push(`  reasons: ${item.update.riskReasons.join("; ")}`);
      }
      if (item.update.recommendedAction) {
        lines.push(`  action: ${item.update.recommendedAction}`);
      }
      if (item.update.releaseNotesSummary) {
        lines.push(`  notes: ${item.update.releaseNotesSummary.title} - ${item.update.releaseNotesSummary.excerpt}`);
      }
      if (item.update.homepage) {
        lines.push(`  homepage: ${item.update.homepage}`);
      }
    }
  }
  if (review.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of review.errors) {
      lines.push(`- ${error}`);
    }
  }
  if (review.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of review.warnings) {
      lines.push(`- ${warning}`);
    }
  }
  lines.push("");
  lines.push(
    `Summary: ${review.summary.updatesFound} updates, riskPackages=${review.summary.riskPackages ?? 0}, securityPackages=${review.summary.securityPackages ?? 0}, peerConflictPackages=${review.summary.peerConflictPackages ?? 0}`,
  );
  return lines.join("\n");
}

function matchesReviewFilters(
  item: ReviewItem,
  options: ReviewOptions | DoctorOptions | CheckOptions,
): boolean {
  if ("securityOnly" in options && options.securityOnly && item.advisories.length === 0) {
    return false;
  }
  if ("risk" in options && options.risk && !riskMatches(item.update.riskLevel, options.risk)) {
    return false;
  }
  if ("diff" in options && options.diff && item.update.diffType !== options.diff) {
    return false;
  }
  return true;
}

function riskMatches(
  current: ReviewItem["update"]["riskLevel"] | undefined,
  threshold: NonNullable<ReviewOptions["risk"]>,
): boolean {
  const order: Record<NonNullable<ReviewOptions["risk"]>, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };
  return order[current ?? "low"] >= order[threshold];
}

function createReviewSummary(
  base: Summary,
  items: ReviewItem[],
  errors: string[],
  warnings: string[],
  interactiveSession: boolean,
  degradedSources: string[],
): Summary {
  const summary = finalizeSummary(
    createSummary({
      scannedPackages: base.scannedPackages,
      totalDependencies: base.totalDependencies,
      checkedDependencies: base.checkedDependencies,
      updatesFound: items.length,
      upgraded: base.upgraded,
      skipped: base.skipped,
      warmedPackages: base.warmedPackages,
      errors,
      warnings,
      durations: {
        totalMs: base.durationMs.total,
        discoveryMs: base.durationMs.discovery,
        registryMs: base.durationMs.registry,
        cacheMs: base.durationMs.cache,
      },
      groupedUpdates: base.groupedUpdates,
      cooldownSkipped: base.cooldownSkipped,
      ciProfile: base.ciProfile,
      prLimitHit: base.prLimitHit,
      policyOverridesApplied: base.policyOverridesApplied,
    }),
  );
  summary.durationMs.render = base.durationMs.render;
  summary.streamedEvents = base.streamedEvents;
  summary.fixPrApplied = base.fixPrApplied;
  summary.fixBranchName = base.fixBranchName;
  summary.fixCommitSha = base.fixCommitSha;
  summary.fixPrBranchesCreated = base.fixPrBranchesCreated;
  summary.interactiveSession = interactiveSession;
  summary.securityPackages = items.filter((item) => item.advisories.length > 0).length;
  summary.riskPackages = items.filter(
    (item) =>
      item.update.riskLevel === "critical" || item.update.riskLevel === "high",
  ).length;
  summary.peerConflictPackages = items.filter(
    (item) => item.update.peerConflictSeverity && item.update.peerConflictSeverity !== "none",
  ).length;
  summary.licenseViolationPackages = items.filter(
    (item) => item.update.licenseStatus === "denied",
  ).length;
  summary.policyActionCounts = {
    allow: items.filter((item) => item.update.policyAction === "allow").length,
    review: items.filter((item) => item.update.policyAction === "review").length,
    block: items.filter((item) => item.update.policyAction === "block").length,
    monitor: items.filter((item) => item.update.policyAction === "monitor").length,
  };
  summary.blockedPackages = items.filter((item) => item.update.decisionState === "blocked").length;
  summary.reviewPackages = items.filter((item) => item.update.decisionState === "review").length;
  summary.monitorPackages = items.filter((item) => item.update.policyAction === "monitor").length;
  summary.decisionPackages = items.length;
  summary.degradedSources = degradedSources;
  summary.verdict = deriveReviewVerdict(items, errors);
  return summary;
}

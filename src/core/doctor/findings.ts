import path from "node:path";
import type { DoctorFinding, ReviewResult } from "../../types/index.js";

export function buildDoctorFindings(review: ReviewResult): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  for (const error of review.errors) {
    findings.push({
      id: `execution-error:${error}`,
      code: "execution-error",
      category: "Registry / Execution",
      severity: "error",
      scope: "project",
      summary: error,
      details: "Execution errors make the scan incomplete or require operator review.",
      help: "Resolve execution and registry issues before treating the run as clean.",
      recommendedAction: "Run `rup review --interactive` after fixing execution failures.",
      evidence: [error],
    });
  }

  for (const degradedSource of review.summary.degradedSources ?? []) {
    findings.push({
      id: `degraded-source:${degradedSource}`,
      code: "degraded-advisory-source",
      category: "Registry / Execution",
      severity: "warning",
      scope: "project",
      summary: `${degradedSource} returned degraded advisory coverage.`,
      details: "Security findings may be partial while an advisory source is degraded.",
      help: "Retry the scan or pin the advisory source when full coverage matters.",
      recommendedAction: "Re-run `rup doctor` or `rup audit --source` once the degraded source recovers.",
      evidence: [degradedSource],
    });
  }

  for (const item of review.items) {
    const workspace = path.basename(item.update.packagePath);
    if (item.update.peerConflictSeverity === "error" || item.update.peerConflictSeverity === "warning") {
      findings.push({
        id: `peer-conflict:${item.update.name}:${workspace}`,
        code: "peer-conflict",
        category: "Compatibility",
        severity: item.update.peerConflictSeverity === "error" ? "error" : "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} has ${item.update.peerConflictSeverity} peer conflicts after the proposed upgrade.`,
        details: item.peerConflicts[0]?.suggestion,
        help: "Inspect peer dependency requirements before applying the update.",
        recommendedAction: item.update.recommendedAction ?? "Review peer requirements in `rup review --interactive`.",
        evidence: item.peerConflicts.map((conflict) => `${conflict.requester} -> ${conflict.peer}@${conflict.requiredRange}`),
      });
    }

    if (item.update.licenseStatus === "denied") {
      findings.push({
        id: `license-denied:${item.update.name}:${workspace}`,
        code: "license-policy-denied",
        category: "Licensing",
        severity: "error",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} violates the current license policy.`,
        details: item.license?.license,
        help: "Keep denied licenses out of the approved update set.",
        recommendedAction: item.update.recommendedAction ?? "Block this package in `rup review --interactive`.",
      });
    }

    if ((item.update.advisoryCount ?? 0) > 0) {
      findings.push({
        id: `security-advisory:${item.update.name}:${workspace}`,
        code: "security-advisory",
        category: "Security",
        severity: item.update.riskLevel === "critical" ? "error" : "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} has ${item.update.advisoryCount} known security advisories.`,
        details: item.advisories[0]?.title,
        help: "Prioritize secure minimum upgrades before applying other dependency changes.",
        recommendedAction:
          item.update.recommendedAction ??
          "Run `rup review --security-only` and consider `rup audit --fix` for minimum safe patches.",
        evidence: item.advisories.map((advisory) => advisory.cveId),
      });
    }

    if (item.update.riskLevel === "critical" || item.update.riskLevel === "high") {
      findings.push({
        id: `release-risk:${item.update.name}:${workspace}`,
        code: item.update.riskLevel === "critical" ? "release-risk-critical" : "release-risk-high",
        category: "Release Risk",
        severity: item.update.riskLevel === "critical" ? "error" : "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} is classified as ${item.update.riskLevel} release risk.`,
        details: item.update.riskReasons?.[0],
        help: "Use review mode to inspect why the update was classified as risky before applying it.",
        recommendedAction: item.update.recommendedAction ?? "Keep this package in review until risk reasons are cleared.",
        evidence: item.update.riskReasons,
      });
    }

    if (item.update.diffType === "major") {
      findings.push({
        id: `major-upgrade:${item.update.name}:${workspace}`,
        code: "major-upgrade",
        category: "Release Risk",
        severity: "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} is a major version upgrade.`,
        help: "Major upgrades should be reviewed explicitly before being applied.",
        recommendedAction: item.update.recommendedAction ?? "Review major changes in `rup review --interactive`.",
      });
    }

    if (item.update.healthStatus === "stale" || item.update.healthStatus === "archived") {
      findings.push({
        id: `health:${item.update.name}:${workspace}`,
        code: item.update.healthStatus === "archived" ? "package-archived" : "package-stale",
        category: "Operational Health",
        severity: "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} is flagged as ${item.update.healthStatus}.`,
        help: "Monitor package health and plan alternatives if maintenance does not improve.",
        recommendedAction: item.update.monitorReason ?? "Keep this package under monitoring in `rup review`.",
      });
    }

    if (item.unusedIssues.length > 0) {
      findings.push({
        id: `unused:${item.update.name}:${workspace}`,
        code: "unused-dependency-signal",
        category: "Unused / Cleanup",
        severity: "warning",
        scope: "package",
        packageName: item.update.name,
        workspace,
        summary: `${item.update.name} has unused or missing dependency signals.`,
        details: item.unusedIssues[0]?.kind,
        help: "Clean up unused or missing dependencies before widening the upgrade scope.",
        recommendedAction: "Run `rup unused` to inspect cleanup opportunities.",
      });
    }
  }

  return findings.sort(compareDoctorFindings);
}

function compareDoctorFindings(left: DoctorFinding, right: DoctorFinding): number {
  const severityOrder = { error: 0, warning: 1 } as const;
  const categoryOrder = {
    Security: 0,
    Compatibility: 1,
    Policy: 2,
    Licensing: 3,
    "Release Risk": 4,
    "Operational Health": 5,
    "Unused / Cleanup": 6,
    "Workspace Integrity": 7,
    "Registry / Execution": 8,
  } as const;

  const bySeverity = severityOrder[left.severity] - severityOrder[right.severity];
  if (bySeverity !== 0) return bySeverity;
  const byCategory = categoryOrder[left.category] - categoryOrder[right.category];
  if (byCategory !== 0) return byCategory;
  const leftTarget = `${left.packageName ?? ""}:${left.workspace ?? ""}:${left.code}`;
  const rightTarget = `${right.packageName ?? ""}:${right.workspace ?? ""}:${right.code}`;
  return leftTarget.localeCompare(rightTarget);
}

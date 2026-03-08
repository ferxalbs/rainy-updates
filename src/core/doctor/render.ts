import type { DoctorResult } from "../../types/index.js";

export function renderDoctorResult(result: DoctorResult, verdictOnly = false): string {
  const state = deriveState(result.score);
  const riskLevel = deriveRiskLevel(result);
  const packageManager = result.review.analysis.check.packageManager;
  const workspace = result.review.analysis.check.packagePaths.length > 1 ? "yes" : "no";
  const duration = formatMs(result.review.summary.durationMs.total);
  const summary = [
    `${result.summary.securityPackages ?? 0} known vulnerabilities`,
    `${result.summary.updatesFound} updates available`,
    `${result.summary.peerConflictPackages ?? 0} peer dependency conflicts`,
    `${countStaleFindings(result)} stale packages`,
    `${result.summary.licenseViolationPackages ?? 0} license violations`,
    `${result.summary.blockedPackages ?? 0} blocked policy violations`,
  ];
  const prioritized = result.findings.slice(0, 5);
  const nextCommands = recommendedCommands(result);

  if (verdictOnly) {
    return [
      `Health Score: ${result.score}/100`,
      `State: ${state}`,
      `Risk Level: ${riskLevel}`,
      `Next Action: ${result.recommendedCommand}`,
    ].join("\n");
  }

  const lines = [
    "Rainy Updates Doctor",
    "────────────────────────────────────────────────────────",
    `Health Score: ${result.score}/100`,
    `State: ${state}`,
    `Risk Level: ${riskLevel}`,
    `Package Manager: ${packageManager}`,
    `Workspace: ${workspace}`,
    `Checked in: ${duration}`,
    "",
    "Summary",
    ...summary.map((entry) => `• ${entry}`),
    "",
    "Priority Findings",
  ];

  if (prioritized.length === 0) {
    lines.push("No action required. Your dependency state is clean.");
  } else {
    prioritized.forEach((finding, index) => {
      lines.push(`${index + 1}. ${finding.summary}`);
    });
  }

  lines.push("");
  lines.push("Recommended Action");
  lines.push(...recommendedAction(result, riskLevel).map((entry) => `• ${entry}`));
  lines.push("");
  lines.push("Next Commands");
  lines.push(...nextCommands.map((entry) => `› ${entry}`));
  return lines.join("\n");
}

export function renderDoctorAgentReport(result: DoctorResult): string {
  const lines = [
    `Rainy Updates doctor report for ${result.review.projectPath}`,
    `State: ${result.verdict}`,
    `Score: ${result.score}/100 (${result.scoreLabel})`,
    `PrimaryRisk: ${result.primaryFindings[0] ?? "No blocking findings."}`,
    `NextAction: ${result.recommendedCommand}`,
    `Why: ${result.nextActionReason}`,
    "",
    "Priority findings:",
  ];

  const findings = result.findings.slice(0, 8);
  if (findings.length === 0) {
    lines.push("- No blocking findings detected.");
  } else {
    for (const finding of findings) {
      const target = finding.packageName ? ` package=${finding.packageName}` : "";
      lines.push(`- [${finding.severity}] ${finding.category}${target}: ${finding.summary}`);
      if (finding.recommendedAction) {
        lines.push(`  fix: ${finding.recommendedAction}`);
      }
      if (finding.help) {
        lines.push(`  help: ${finding.help}`);
      }
    }
  }

  lines.push("");
  lines.push(`Verification: ${result.recommendedCommand}`);
  return lines.join("\n");
}

function deriveState(score: number): string {
  if (score >= 90) return "Healthy";
  if (score >= 75) return "Warning";
  if (score >= 50) return "At Risk";
  return "Critical";
}

function deriveRiskLevel(result: DoctorResult): string {
  const hasCritical = result.findings.some(
    (finding) =>
      finding.severity === "error" &&
      (finding.category === "Security" || finding.category === "Policy"),
  );
  if (hasCritical || result.verdict === "blocked") return "Severe";
  const hasHigh = result.findings.some((finding) => finding.severity === "error");
  if (hasHigh || (result.summary.riskPackages ?? 0) > 0) return "High";
  const hasModerate = result.findings.some(
    (finding) => finding.category === "Release Risk" || finding.category === "Compatibility",
  );
  if (hasModerate || result.summary.updatesFound > 0) return "Moderate";
  return "Low";
}

function recommendedAction(result: DoctorResult, riskLevel: string): string[] {
  if (riskLevel === "Severe") {
    return [
      "Do not apply broad upgrades automatically.",
      "Resolve security and blocked policy findings first.",
      "Review major upgrades manually before mutation.",
    ];
  }
  if (riskLevel === "High") {
    return [
      "Review high-risk updates before applying changes.",
      "Separate major upgrades from routine patch/minor runs.",
      "Enable install and test verification before merge.",
    ];
  }
  if (result.summary.updatesFound > 0) {
    return [
      "Safe to apply routine updates in controlled batches.",
      "Keep review enabled for medium-risk dependency changes.",
    ];
  }
  return [
    "No action required. Your dependency state is clean.",
    "Continue routine checks in CI.",
  ];
}

function recommendedCommands(result: DoctorResult): string[] {
  if (result.summary.securityPackages && result.summary.securityPackages > 0) {
    return [
      "rup audit --severity high",
      "rup review --security-only",
      "rup upgrade --verify install,test --test-command \"bun test\"",
    ];
  }
  if ((result.summary.riskPackages ?? 0) > 0 || (result.summary.blockedPackages ?? 0) > 0) {
    return [
      "rup review --risk high --diff major",
      "rup snapshot save --label \"pre-upgrade\"",
      "rup upgrade --verify install,test --test-command \"bun test\"",
    ];
  }
  if (result.summary.updatesFound > 0) {
    return [
      "rup review",
      "rup upgrade --target minor",
      "rup health --stale 180d",
    ];
  }
  return [
    "rup check",
    "rup audit",
  ];
}

function countStaleFindings(result: DoctorResult): number {
  return result.findings.filter((finding) => finding.code === "package-stale").length;
}

function formatMs(durationMs: number): string {
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

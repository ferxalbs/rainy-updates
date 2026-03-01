import type { DoctorResult } from "../../types/index.js";

export function renderDoctorResult(result: DoctorResult, verdictOnly = false): string {
  const lines = [
    `State: ${result.verdict}`,
    `Score: ${result.score}/100 (${result.scoreLabel})`,
    `PrimaryRisk: ${result.primaryFindings[0] ?? "No blocking findings."}`,
    `NextAction: ${result.recommendedCommand}`,
  ];
  if (!verdictOnly) {
    lines.push(
      `Counts: updates=${result.summary.updatesFound}, security=${result.summary.securityPackages ?? 0}, risk=${result.summary.riskPackages ?? 0}, peer=${result.summary.peerConflictPackages ?? 0}, license=${result.summary.licenseViolationPackages ?? 0}`,
    );
    lines.push(`NextActionReason: ${result.nextActionReason}`);
  }
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

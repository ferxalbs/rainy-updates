import type { CheckResult } from "../types/index.js";
import { writeFileAtomic } from "../utils/io.js";

export async function writeGitHubOutput(filePath: string, result: CheckResult): Promise<void> {
  const lines = [
    `contract_version=${result.summary.contractVersion}`,
    `updates_found=${result.summary.updatesFound}`,
    `errors_count=${result.summary.errorCounts.total}`,
    `warnings_count=${result.summary.warningCounts.total}`,
    `checked_dependencies=${result.summary.checkedDependencies}`,
    `scanned_packages=${result.summary.scannedPackages}`,
    `warmed_packages=${result.summary.warmedPackages}`,
    `fail_reason=${result.summary.failReason}`,
    `duration_total_ms=${result.summary.durationMs.total}`,
    `duration_discovery_ms=${result.summary.durationMs.discovery}`,
    `duration_registry_ms=${result.summary.durationMs.registry}`,
    `duration_cache_ms=${result.summary.durationMs.cache}`,
    `duration_render_ms=${result.summary.durationMs.render}`,
    `grouped_updates=${result.summary.groupedUpdates}`,
    `cooldown_skipped=${result.summary.cooldownSkipped}`,
    `ci_profile=${result.summary.ciProfile}`,
    `pr_limit_hit=${result.summary.prLimitHit === true ? "1" : "0"}`,
    `streamed_events=${result.summary.streamedEvents}`,
    `policy_overrides_applied=${result.summary.policyOverridesApplied}`,
    `registry_auth_failures=${result.summary.errorCounts.registryAuthFailure}`,
    `verdict=${result.summary.verdict ?? ""}`,
    `risk_packages=${result.summary.riskPackages ?? 0}`,
    `security_packages=${result.summary.securityPackages ?? 0}`,
    `peer_conflict_packages=${result.summary.peerConflictPackages ?? 0}`,
    `license_violation_packages=${result.summary.licenseViolationPackages ?? 0}`,
    `run_id=${result.summary.runId ?? ""}`,
    `artifact_manifest=${result.summary.artifactManifest ?? ""}`,
    `blocked_packages=${result.summary.blockedPackages ?? 0}`,
    `review_packages=${result.summary.reviewPackages ?? 0}`,
    `monitor_packages=${result.summary.monitorPackages ?? 0}`,
    `cache_backend=${result.summary.cacheBackend ?? ""}`,
    `degraded_sources=${(result.summary.degradedSources ?? []).join(",")}`,
    `ga_ready=${result.summary.gaReady === true ? "1" : "0"}`,
    `dependency_health_score=${result.summary.dependencyHealthScore ?? ""}`,
    `primary_finding_code=${result.summary.primaryFindingCode ?? ""}`,
    `primary_finding_category=${result.summary.primaryFindingCategory ?? ""}`,
    `next_action_reason=${result.summary.nextActionReason ?? ""}`,
    `suggested_command=${result.summary.suggestedCommand ?? ""}`,
    `decision_plan=${result.summary.decisionPlan ?? ""}`,
    `interactive_surface=${result.summary.interactiveSurface ?? ""}`,
    `queue_focus=${result.summary.queueFocus ?? ""}`,
    `fix_pr_applied=${result.summary.fixPrApplied === true ? "1" : "0"}`,
    `fix_pr_branches_created=${result.summary.fixPrBranchesCreated}`,
    `fix_pr_branch=${result.summary.fixBranchName ?? ""}`,
    `fix_pr_commit=${result.summary.fixCommitSha ?? ""}`,
  ];

  await writeFileAtomic(filePath, lines.join("\n") + "\n");
}

export function renderGitHubAnnotations(result: CheckResult): string {
  const lines: string[] = [];

  const sortedUpdates = [...result.updates].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.packagePath.localeCompare(right.packagePath);
  });
  for (const update of sortedUpdates) {
    lines.push(
      `::notice title=Dependency Update::${update.name} ${update.fromRange} -> ${update.toRange} (${update.packagePath})${typeof update.riskScore === "number" ? ` [risk=${update.riskLevel}:${update.riskScore}]` : ""}`,
    );
  }

  for (const warning of [...result.warnings].sort((a, b) => a.localeCompare(b))) {
    lines.push(`::warning title=Rainy Updates::${warning}`);
  }

  for (const error of [...result.errors].sort((a, b) => a.localeCompare(b))) {
    lines.push(`::error title=Rainy Updates::${error}`);
  }

  if (lines.length === 0) {
    lines.push("::notice title=Rainy Updates::No updates found");
  }

  return lines.join("\n");
}

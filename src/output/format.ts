import type { CheckResult, OutputFormat } from "../types/index.js";
import { renderGitHubAnnotations } from "./github.js";
import { stableStringify } from "../utils/stable-json.js";

export function renderResult(
  result: CheckResult,
  format: OutputFormat,
  display: { showImpact?: boolean; showHomepage?: boolean } = {},
): string {
  if (format === "json") {
    return stableStringify(result, 2);
  }

  if (format === "minimal") {
    if (result.updates.length === 0 && result.summary.warmedPackages > 0) {
      return `Cache warmed for ${result.summary.warmedPackages} package(s).`;
    }
    if (result.updates.length === 0 && result.errors.length > 0) {
      const [firstError] = result.errors;
      const suffix =
        result.errors.length > 1 ? ` (+${result.errors.length - 1} more errors)` : "";
      return `${firstError}${suffix}`;
    }
    if (result.updates.length === 0) return "No updates found.";
    return result.updates
      .map((item) => {
        const parts = [`${item.packagePath} :: ${item.name}: ${item.fromRange} -> ${item.toRange}`];
        if (display.showImpact && item.impactScore) {
          parts.push(`impact=${item.impactScore.rank}:${item.impactScore.score}`);
        }
        if (typeof item.riskScore === "number") {
          parts.push(`risk=${item.riskLevel}:${item.riskScore}`);
        }
        if (display.showHomepage && item.homepage) {
          parts.push(item.homepage);
        }
        return parts.join(" | ");
      })
      .join("\n");
  }

  if (format === "github") {
    return renderGitHubAnnotations(result);
  }

  if (format === "metrics") {
    return [
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
      `pr_limit_hit=${result.summary.prLimitHit ? "1" : "0"}`,
      `streamed_events=${result.summary.streamedEvents}`,
      `policy_overrides_applied=${result.summary.policyOverridesApplied}`,
      `registry_auth_failures=${result.summary.errorCounts.registryAuthFailure}`,
      `fix_pr_branches_created=${result.summary.fixPrBranchesCreated}`,
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
    ].join("\n");
  }

  const lines: string[] = [];
  lines.push(`Project: ${result.projectPath}`);
  lines.push(`Scanned packages: ${result.summary.scannedPackages}`);
  lines.push(`Package manager: ${result.packageManager}`);
  lines.push(`Target: ${result.target}`);
  lines.push("");

  if (result.updates.length === 0) {
    if (result.summary.warmedPackages > 0) {
      lines.push(`Cache warmed for ${result.summary.warmedPackages} package(s).`);
    } else {
      lines.push("No updates found.");
    }
  } else {
    lines.push("Updates:");
    for (const update of result.updates) {
      lines.push(
        `- ${update.packagePath} :: ${update.name} [${update.kind}] ${update.fromRange} -> ${update.toRange} (${[
          update.diffType,
          display.showImpact && update.impactScore
            ? `impact=${update.impactScore.rank}:${update.impactScore.score}`
            : undefined,
          display.showHomepage && update.homepage ? update.homepage : undefined,
          update.riskLevel ? `risk=${update.riskLevel}` : undefined,
          typeof update.riskScore === "number" ? `score=${update.riskScore}` : undefined,
          update.policyAction ? `policy=${update.policyAction}` : undefined,
        ]
          .filter(Boolean)
          .join(", ")})`,
      );
      if (update.recommendedAction) {
        lines.push(`  action: ${update.recommendedAction}`);
      }
      if (update.releaseNotesSummary) {
        lines.push(`  notes: ${update.releaseNotesSummary.title} — ${update.releaseNotesSummary.excerpt}`);
      }
    }
  }

  if (result.errors.length > 0) {
    lines.push("");
    lines.push("Errors:");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${result.summary.updatesFound} updates, ${result.summary.checkedDependencies}/${result.summary.totalDependencies} checked, ${result.summary.warmedPackages} warmed`,
  );
  lines.push(
    `Groups=${result.summary.groupedUpdates}, cooldownSkipped=${result.summary.cooldownSkipped}, ciProfile=${result.summary.ciProfile}, prLimitHit=${result.summary.prLimitHit ? "yes" : "no"}`,
  );
  lines.push(
    `StreamedEvents=${result.summary.streamedEvents}, policyOverrides=${result.summary.policyOverridesApplied}, registryAuthFailures=${result.summary.errorCounts.registryAuthFailure}`,
  );
  if (result.summary.verdict) {
    lines.push(
      `Verdict=${result.summary.verdict}, riskPackages=${result.summary.riskPackages ?? 0}, securityPackages=${result.summary.securityPackages ?? 0}, peerConflictPackages=${result.summary.peerConflictPackages ?? 0}, licenseViolationPackages=${result.summary.licenseViolationPackages ?? 0}`,
    );
  }
  if (typeof result.summary.dependencyHealthScore === "number") {
    lines.push(
      `DependencyHealthScore=${result.summary.dependencyHealthScore}, primaryFinding=${result.summary.primaryFindingCode ?? "none"}, category=${result.summary.primaryFindingCategory ?? "none"}`,
    );
  }
  if (result.summary.runId) {
    lines.push(
      `RunId=${result.summary.runId}, artifactManifest=${result.summary.artifactManifest ?? "none"}, blockedPackages=${result.summary.blockedPackages ?? 0}, reviewPackages=${result.summary.reviewPackages ?? 0}, monitorPackages=${result.summary.monitorPackages ?? 0}`,
    );
  }
  lines.push(
    `Contract v${result.summary.contractVersion}, failReason=${result.summary.failReason}, duration=${result.summary.durationMs.total}ms`,
  );
  if (result.summary.fixPrApplied) {
    lines.push(`Fix PR: applied on branch ${result.summary.fixBranchName ?? "unknown"} (${result.summary.fixCommitSha ?? "no-commit"})`);
    lines.push(`Fix PR batches created: ${result.summary.fixPrBranchesCreated}`);
  }

  return lines.join("\n");
}

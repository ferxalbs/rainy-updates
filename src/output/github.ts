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
      `::notice title=Dependency Update::${update.name} ${update.fromRange} -> ${update.toRange} (${update.packagePath})`,
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

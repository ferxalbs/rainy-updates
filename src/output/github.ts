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
    `fix_pr_applied=${result.summary.fixPrApplied === true ? "1" : "0"}`,
    `fix_pr_branch=${result.summary.fixBranchName ?? ""}`,
    `fix_pr_commit=${result.summary.fixCommitSha ?? ""}`,
  ];

  await writeFileAtomic(filePath, lines.join("\n") + "\n");
}

export function renderGitHubAnnotations(result: CheckResult): string {
  const lines: string[] = [];

  for (const update of result.updates) {
    lines.push(
      `::notice title=Dependency Update::${update.name} ${update.fromRange} -> ${update.toRange} (${update.packagePath})`,
    );
  }

  for (const warning of result.warnings) {
    lines.push(`::warning title=Rainy Updates::${warning}`);
  }

  for (const error of result.errors) {
    lines.push(`::error title=Rainy Updates::${error}`);
  }

  if (lines.length === 0) {
    lines.push("::notice title=Rainy Updates::No updates found");
  }

  return lines.join("\n");
}

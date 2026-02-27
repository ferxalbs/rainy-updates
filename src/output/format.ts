import type { CheckResult, OutputFormat } from "../types/index.js";
import { renderGitHubAnnotations } from "./github.js";
import { stableStringify } from "../utils/stable-json.js";

export function renderResult(result: CheckResult, format: OutputFormat): string {
  if (format === "json") {
    return stableStringify(result, 2);
  }

  if (format === "minimal") {
    if (result.updates.length === 0 && result.summary.warmedPackages > 0) {
      return `Cache warmed for ${result.summary.warmedPackages} package(s).`;
    }
    if (result.updates.length === 0) return "No updates found.";
    return result.updates
      .map((item) => `${item.packagePath} :: ${item.name}: ${item.fromRange} -> ${item.toRange}`)
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
        `- ${update.packagePath} :: ${update.name} [${update.kind}] ${update.fromRange} -> ${update.toRange} (${update.diffType})`,
      );
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
    `Contract v${result.summary.contractVersion}, failReason=${result.summary.failReason}, duration=${result.summary.durationMs.total}ms`,
  );
  if (result.summary.fixPrApplied) {
    lines.push(`Fix PR: applied on branch ${result.summary.fixBranchName ?? "unknown"} (${result.summary.fixCommitSha ?? "no-commit"})`);
  }

  return lines.join("\n");
}

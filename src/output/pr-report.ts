import type { CheckResult } from "../types/index.js";

export function renderPrReport(result: CheckResult): string {
  const lines: string[] = [];
  lines.push("# Dependency Update Report");
  lines.push("");
  lines.push(`- Scanned packages: ${result.summary.scannedPackages}`);
  lines.push(`- Checked dependencies: ${result.summary.checkedDependencies}`);
  lines.push(`- Updates found: ${result.summary.updatesFound}`);
  lines.push(`- Errors: ${result.errors.length}`);
  lines.push(`- Warnings: ${result.warnings.length}`);
  lines.push(`- Grouped updates: ${result.summary.groupedUpdates}`);
  lines.push(`- Cooldown skipped: ${result.summary.cooldownSkipped}`);
  lines.push(`- CI profile: ${result.summary.ciProfile}`);
  lines.push(`- PR limit hit: ${result.summary.prLimitHit ? "yes" : "no"}`);
  lines.push("");

  if (result.updates.length > 0) {
    lines.push("## Proposed Updates");
    lines.push("");
    lines.push("| Package | From | To | Type | Path |");
    lines.push("|---|---|---|---|---|");
    for (const update of result.updates) {
      lines.push(
        `| ${update.name} | ${update.fromRange} | ${update.toRange} | ${update.diffType} | ${update.packagePath} |`,
      );
    }
    lines.push("");
  }

  if (result.errors.length > 0) {
    lines.push("## Errors");
    lines.push("");
    for (const error of result.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  if (result.warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

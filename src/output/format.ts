import type { CheckResult, OutputFormat } from "../types/index.js";
import { renderGitHubAnnotations } from "./github.js";

export function renderResult(result: CheckResult, format: OutputFormat): string {
  if (format === "json") {
    return JSON.stringify(result, null, 2);
  }

  if (format === "minimal") {
    if (result.updates.length === 0) return "No updates found.";
    return result.updates
      .map((item) => `${item.packagePath} :: ${item.name}: ${item.fromRange} -> ${item.toRange}`)
      .join("\n");
  }

  if (format === "github") {
    return renderGitHubAnnotations(result);
  }

  const lines: string[] = [];
  lines.push(`Project: ${result.projectPath}`);
  lines.push(`Scanned packages: ${result.summary.scannedPackages}`);
  lines.push(`Package manager: ${result.packageManager}`);
  lines.push(`Target: ${result.target}`);
  lines.push("");

  if (result.updates.length === 0) {
    lines.push("No updates found.");
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
    `Summary: ${result.summary.updatesFound} updates, ${result.summary.checkedDependencies}/${result.summary.totalDependencies} checked`,
  );

  return lines.join("\n");
}

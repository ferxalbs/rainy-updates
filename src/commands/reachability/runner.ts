import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { ReachabilityOptions, ReachabilityResult } from "../../types/index.js";
import { runReachabilityService } from "../../services/reachability.js";

export async function runReachability(
  options: ReachabilityOptions,
): Promise<ReachabilityResult> {
  const result = await runReachabilityService(options);

  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : options.format === "summary"
        ? renderSummary(result)
        : renderTable(result);

  writeStdout(rendered + "\n");

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }

  return result;
}

function renderSummary(result: ReachabilityResult): string {
  return [
    "Reachability Summary",
    `reachable=${result.summary.reachable}`,
    `not-reachable=${result.summary.notReachable}`,
    `unknown=${result.summary.unknown}`,
    `suppressed-by-exceptions=${result.summary.suppressedByExceptions}`,
  ].join("\n");
}

function renderTable(result: ReachabilityResult): string {
  const lines = [
    "Reachability Findings",
    `Totals: reachable=${result.summary.reachable}, not-reachable=${result.summary.notReachable}, unknown=${result.summary.unknown}, suppressed=${result.summary.suppressedByExceptions}`,
  ];

  for (const finding of result.findings) {
    lines.push(
      `- ${finding.packageName} ${finding.cveId} [${finding.severity}] => ${finding.status} (confidence=${Math.round(finding.confidence * 100)}%)${finding.suppressed ? " [exception]" : ""}`,
    );
  }

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}

import { runSelfUpdateService } from "../../services/self-update.js";
import { writeFileAtomic } from "../../utils/io.js";
import { stableStringify } from "../../utils/stable-json.js";
import { writeStdout } from "../../utils/runtime.js";
import type { SelfUpdateOptions, SelfUpdateResult } from "../../types/index.js";

export async function runSelfUpdate(options: SelfUpdateOptions): Promise<SelfUpdateResult> {
  const result = await runSelfUpdateService(options);

  writeStdout(renderSelfUpdateResult(result) + "\n");
  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, stableStringify(result, 2) + "\n");
  }
  return result;
}

function renderSelfUpdateResult(result: SelfUpdateResult): string {
  const lines = [
    "Rainy Updates Self-Update",
    "────────────────────────────────────────────────────────",
    `Current: v${result.currentVersion}`,
    `Latest: ${result.latestVersion ? `v${result.latestVersion}` : "unknown"}`,
    `Outdated: ${result.outdated ? "yes" : "no"}`,
    `Channel: ${result.channel}`,
    `Action: ${result.action}`,
    `Applied: ${result.applied ? "yes" : "no"}`,
    `Recommended: ${result.recommendedCommand}`,
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings");
    lines.push(...result.warnings.map((warning) => `• ${warning}`));
  }
  if (result.errors.length > 0) {
    lines.push("", "Errors");
    lines.push(...result.errors.map((error) => `• ${error}`));
  }

  return lines.join("\n");
}

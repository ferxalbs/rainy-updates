import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { AttestOptions, AttestResult } from "../../types/index.js";
import { runAttestService } from "../../services/attest.js";

export async function runAttest(options: AttestOptions): Promise<AttestResult> {
  const result = await runAttestService(options);

  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : renderTable(result);

  writeStdout(`${rendered}\n`);

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, `${stableStringify(result, 2)}\n`);
  }

  return result;
}

function renderTable(result: AttestResult): string {
  const lines = [
    `Attest action: ${result.action}`,
    `Passed: ${result.passed ? "yes" : "no"}`,
    `Policy: ${result.policyAction}`,
    `Recommended: ${result.recommendedAction}`,
    "",
    "Checks:",
  ];

  for (const check of result.checks) {
    lines.push(`- ${check.id}: ${check.status} :: ${check.message}`);
    if (check.evidence) {
      lines.push(`  evidence: ${check.evidence}`);
    }
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

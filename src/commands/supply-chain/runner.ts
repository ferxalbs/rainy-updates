import { stableStringify } from "../../utils/stable-json.js";
import { writeFileAtomic } from "../../utils/io.js";
import { writeStdout } from "../../utils/runtime.js";
import type { SupplyChainOptions, SupplyChainResult } from "../../types/index.js";
import { runSupplyChainService } from "../../services/supply-chain.js";

export async function runSupplyChain(
  options: SupplyChainOptions,
): Promise<SupplyChainResult> {
  const result = await runSupplyChainService(options);

  const rendered =
    options.format === "json"
      ? stableStringify(result, 2)
      : options.format === "summary"
        ? renderSummary(result)
        : renderTable(result);

  writeStdout(`${rendered}\n`);

  if (options.jsonFile) {
    await writeFileAtomic(options.jsonFile, `${stableStringify(result, 2)}\n`);
  }

  return result;
}

function renderSummary(result: SupplyChainResult): string {
  return [
    "Supply-chain Summary",
    `scanned-files=${result.summary.scannedFiles}`,
    `findings=${result.summary.totalFindings}`,
    `policy.allow=${result.summary.byPolicyAction.allow}`,
    `policy.review=${result.summary.byPolicyAction.review}`,
    `policy.block=${result.summary.byPolicyAction.block}`,
    `policy.monitor=${result.summary.byPolicyAction.monitor}`,
  ].join("\n");
}

function renderTable(result: SupplyChainResult): string {
  const lines = [
    "Supply-chain Findings",
    `Totals: files=${result.summary.scannedFiles}, findings=${result.summary.totalFindings}, allow=${result.summary.byPolicyAction.allow}, review=${result.summary.byPolicyAction.review}, block=${result.summary.byPolicyAction.block}`,
  ];

  for (const finding of result.findings) {
    lines.push(
      `- [${finding.targetType}] ${finding.name}@${finding.reference} :: ${finding.riskLevel} / ${finding.policyAction}`,
      `  source: ${finding.sourceFile}`,
      `  action: ${finding.recommendedAction}`,
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

import type { CheckResult } from "../types/index.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function createSarifReport(result: CheckResult): Record<string, unknown> {
  const dependencyRuleId = "rainy-updates/dependency-update";
  const runtimeRuleId = "rainy-updates/runtime-error";

  const sortedUpdates = [...result.updates].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) return byName;
    return left.packagePath.localeCompare(right.packagePath);
  });
  const updateResults = sortedUpdates.map((update) => ({
    ruleId: dependencyRuleId,
    level: "warning",
    message: {
      text: `${update.name} can be updated from ${update.fromRange} to ${update.toRange}`,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: `${update.packagePath}/package.json`,
          },
        },
      },
    ],
    properties: {
      dependency: update.name,
      kind: update.kind,
      diffType: update.diffType,
      resolvedVersion: update.toVersionResolved,
    },
  }));

  const errorResults = [...result.errors].sort((a, b) => a.localeCompare(b)).map((error) => ({
    ruleId: runtimeRuleId,
    level: "error",
    message: {
      text: error,
    },
  }));

  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "@rainy-updates/cli",
            version: getToolVersion(),
            rules: [
              {
                id: dependencyRuleId,
                shortDescription: { text: "Dependency update available" },
                fullDescription: { text: "A dependency has a newer version according to configured target." },
              },
              {
                id: runtimeRuleId,
                shortDescription: { text: "Dependency resolution error" },
                fullDescription: { text: "The resolver could not fetch or parse package metadata." },
              },
            ],
          },
        },
        results: [...updateResults, ...errorResults],
        properties: {
          contractVersion: result.summary.contractVersion,
          failReason: result.summary.failReason,
          updatesFound: result.summary.updatesFound,
          groupedUpdates: result.summary.groupedUpdates,
          cooldownSkipped: result.summary.cooldownSkipped,
          errorsCount: result.summary.errorCounts.total,
          warningsCount: result.summary.warningCounts.total,
          ciProfile: result.summary.ciProfile,
          prLimitHit: result.summary.prLimitHit,
          fixPrBranchesCreated: result.summary.fixPrBranchesCreated,
          durationMs: result.summary.durationMs,
        },
      },
    ],
  };
}

let TOOL_VERSION_CACHE: string | null = null;

function getToolVersion(): string {
  if (TOOL_VERSION_CACHE) return TOOL_VERSION_CACHE;

  try {
    const currentFile = fileURLToPath(import.meta.url);
    const packageJsonPath = path.resolve(path.dirname(currentFile), "../../package.json");
    const content = readFileSync(packageJsonPath, "utf8");
    const parsed = JSON.parse(content) as { version?: string };
    TOOL_VERSION_CACHE = parsed.version ?? "0.0.0";
    return TOOL_VERSION_CACHE;
  } catch {
    TOOL_VERSION_CACHE = "0.0.0";
    return TOOL_VERSION_CACHE;
  }
}

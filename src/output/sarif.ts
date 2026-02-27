import type { CheckResult } from "../types/index.js";

export function createSarifReport(result: CheckResult): Record<string, unknown> {
  const dependencyRuleId = "rainy-updates/dependency-update";
  const runtimeRuleId = "rainy-updates/runtime-error";

  const updateResults = result.updates.map((update) => ({
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

  const errorResults = result.errors.map((error) => ({
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
            version: "0.1.0",
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
      },
    ],
  };
}

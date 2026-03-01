import { expect, test } from "bun:test";
import { createSarifReport } from "../src/output/sarif.js";
import type { CheckResult } from "../src/types/index.js";

test("createSarifReport includes updates and errors", () => {
  const input: CheckResult = {
    projectPath: "/tmp/project",
    packagePaths: ["/tmp/project"],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 1,
      checkedDependencies: 1,
      updatesFound: 1,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      failReason: "none",
      errorCounts: { total: 1, offlineCacheMiss: 0, registryFailure: 0, registryAuthFailure: 0, other: 1 },
      warningCounts: { total: 0, staleCache: 0, other: 0 },
      durationMs: { total: 0, discovery: 0, registry: 0, cache: 0, render: 0 },
      fixPrApplied: false,
      fixBranchName: "",
      fixCommitSha: "",
      fixPrBranchesCreated: 0,
      groupedUpdates: 0,
      cooldownSkipped: 0,
      ciProfile: "minimal",
      prLimitHit: false,
      streamedEvents: 0,
      policyOverridesApplied: 0,
      verdict: "actionable",
      riskPackages: 1,
      securityPackages: 1,
      peerConflictPackages: 0,
      licenseViolationPackages: 0,
      privateRegistryPackages: 0,
    },
    updates: [
      {
        packagePath: "/tmp/project",
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
        autofix: true,
        advisoryCount: 1,
        riskLevel: "critical",
        riskScore: 75,
        riskCategories: ["known-vulnerability", "behavioral-risk"],
        recommendedAction: "Review in `rup review` before applying.",
      },
    ],
    errors: ["sample error"],
    warnings: [],
  };

  const sarif = createSarifReport(input);
  const json = JSON.stringify(sarif);
  expect(json.includes("dependency-update")).toBe(true);
  expect(json.includes("runtime-error")).toBe(true);
  expect(json.includes("react")).toBe(true);
  expect(json.includes("riskScore")).toBe(true);
  expect(json.includes("recommendedAction")).toBe(true);
});

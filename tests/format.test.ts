import { expect, test } from "bun:test";
import { renderResult } from "../src/output/format.js";
import type { CheckResult } from "../src/types/index.js";

test("renderResult minimal surfaces errors before claiming no updates", () => {
  const result: CheckResult = {
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
      updatesFound: 0,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      failReason: "registry-failure",
      errorCounts: {
        total: 2,
        offlineCacheMiss: 0,
        registryFailure: 2,
        registryAuthFailure: 0,
        other: 0,
      },
      warningCounts: {
        total: 0,
        staleCache: 0,
        other: 0,
      },
      durationMs: {
        total: 0,
        discovery: 0,
        registry: 0,
        cache: 0,
        render: 0,
      },
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
      verdict: undefined,
      riskPackages: 0,
      securityPackages: 0,
      peerConflictPackages: 0,
      licenseViolationPackages: 0,
      privateRegistryPackages: 0,
    },
    updates: [],
    errors: [
      "[REGISTRY_ERROR] Unable to resolve react",
      "[REGISTRY_ERROR] Unable to resolve zod",
    ],
    warnings: [],
  };

  const output = renderResult(result, "minimal");

  expect(output).toContain("[REGISTRY_ERROR] Unable to resolve react");
  expect(output).toContain("(+1 more errors)");
  expect(output).not.toBe("No updates found.");
});

test("renderResult json preserves additive risk fields", () => {
  const result: CheckResult = {
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
      errorCounts: {
        total: 0,
        offlineCacheMiss: 0,
        registryFailure: 0,
        registryAuthFailure: 0,
        other: 0,
      },
      warningCounts: {
        total: 0,
        staleCache: 0,
        other: 0,
      },
      durationMs: {
        total: 0,
        discovery: 0,
        registry: 0,
        cache: 0,
        render: 0,
      },
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
      verdict: "review",
      interactiveSession: false,
      riskPackages: 1,
      securityPackages: 0,
      peerConflictPackages: 0,
      licenseViolationPackages: 0,
      privateRegistryPackages: 0,
    },
    updates: [
      {
        packagePath: "/tmp/project",
        name: "react",
        kind: "dependencies",
        fromRange: "^18.0.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
        autofix: true,
        riskLevel: "high",
        riskScore: 60,
        riskCategories: ["behavioral-risk"],
        recommendedAction: "Keep this update in review until the risk reasons are cleared.",
      },
    ],
    errors: [],
    warnings: [],
  };

  const output = renderResult(result, "json");

  expect(output).toContain('"riskScore": 60');
  expect(output).toContain('"riskCategories": [');
  expect(output).toContain('"recommendedAction": "Keep this update in review until the risk reasons are cleared."');
});

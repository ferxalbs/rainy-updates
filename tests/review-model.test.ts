import { expect, test } from "bun:test";
import { createDoctorResult } from "../src/core/review-model.js";
import type { ReviewResult } from "../src/types/index.js";

test("doctor recommends review when the aggregated result contains execution errors", () => {
  const review: ReviewResult = {
    projectPath: "/tmp/project",
    target: "latest",
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
        total: 1,
        offlineCacheMiss: 0,
        registryFailure: 1,
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
      interactiveSession: false,
      riskPackages: 0,
      securityPackages: 0,
      peerConflictPackages: 0,
      licenseViolationPackages: 0,
      privateRegistryPackages: 0,
    },
    items: [],
    updates: [],
    errors: ["[REGISTRY_ERROR] Unable to resolve react"],
    warnings: [],
  };

  const doctor = createDoctorResult(review);

  expect(doctor.verdict).toBe("review");
  expect(doctor.recommendedCommand).toBe("rup review --interactive");
  expect(doctor.primaryFindings[0]).toContain("execution error");
});

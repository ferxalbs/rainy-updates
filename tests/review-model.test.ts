import { expect, test } from "bun:test";
import {
  createDoctorResult,
  renderDoctorAgentReport,
  renderDoctorResult,
  renderReviewResult,
} from "../src/core/review-model.js";
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
    analysis: {
      check: {
        projectPath: "/tmp/project",
        packagePaths: [],
        packageManager: "unknown",
        target: "latest",
        timestamp: new Date(0).toISOString(),
        summary: {} as ReviewResult["summary"],
        updates: [],
        errors: [],
        warnings: [],
      },
      audit: {
        advisories: [],
        packages: [],
        autoFixable: 0,
        errors: [],
        warnings: [],
        sourcesUsed: [],
        sourceHealth: [],
        resolution: { lockfile: 0, manifest: 0, unresolved: 0 },
      },
      resolve: {
        conflicts: [],
        errorConflicts: 0,
        warningConflicts: 0,
        errors: [],
        warnings: [],
      },
      health: {
        metrics: [],
        totalFlagged: 0,
        errors: [],
        warnings: [],
      },
      licenses: {
        packages: [],
        violations: [],
        totalViolations: 0,
        errors: [],
        warnings: [],
      },
      unused: {
        unused: [],
        missing: [],
        totalUnused: 0,
        totalMissing: 0,
        errors: [],
        warnings: [],
      },
      items: [],
      degradedSources: [],
    },
    items: [],
    updates: [],
    errors: ["[REGISTRY_ERROR] Unable to resolve react"],
    warnings: [],
  };

  const doctor = createDoctorResult(review);

  expect(doctor.verdict).toBe("review");
  expect(doctor.score).toBeLessThan(100);
  expect(doctor.scoreLabel).toBe("Strong");
  expect(doctor.findings[0]?.category).toBe("Registry / Execution");
  expect(doctor.findings[0]?.recommendedAction).toBe(
    "Run `rup dashboard --mode review` after fixing execution failures.",
  );
  expect(doctor.recommendedCommand).toBe("rup dashboard --mode review");
  expect(doctor.primaryFindings[0]).toContain("Unable to resolve react");
  expect(doctor.summary.dependencyHealthScore).toBe(88);
  expect(doctor.summary.primaryFindingCode).toBe("execution-error");
  expect(doctor.summary.primaryFindingCategory).toBe("Registry / Execution");
  expect(doctor.summary.findingCountsBySeverity?.error).toBe(1);
  expect(doctor.summary.suggestedCommand).toBe("rup dashboard --mode review");
  expect(renderDoctorResult(doctor, true)).toContain("Health Score: 88/100");
  expect(renderDoctorAgentReport(doctor)).toContain("Priority findings:");
});

test("review render explains when filters exclude all review items", () => {
  const review: ReviewResult = {
    projectPath: "/tmp/project",
    target: "latest",
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 2,
      checkedDependencies: 2,
      updatesFound: 0,
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
      verdict: "safe",
      interactiveSession: false,
      riskPackages: 0,
      securityPackages: 0,
      peerConflictPackages: 0,
      licenseViolationPackages: 0,
      privateRegistryPackages: 0,
    },
    analysis: {
      check: {
        projectPath: "/tmp/project",
        packagePaths: ["/tmp/project"],
        packageManager: "unknown",
        target: "latest",
        timestamp: new Date(0).toISOString(),
        summary: {} as ReviewResult["summary"],
        updates: [],
        errors: [],
        warnings: [],
      },
      audit: {
        advisories: [],
        packages: [],
        autoFixable: 0,
        errors: [],
        warnings: [],
        sourcesUsed: [],
        sourceHealth: [],
        resolution: { lockfile: 0, manifest: 0, unresolved: 0 },
      },
      resolve: {
        conflicts: [],
        errorConflicts: 0,
        warningConflicts: 0,
        errors: [],
        warnings: [],
      },
      health: {
        metrics: [],
        totalFlagged: 0,
        errors: [],
        warnings: [],
      },
      licenses: {
        packages: [],
        violations: [],
        totalViolations: 0,
        errors: [],
        warnings: [],
      },
      unused: {
        unused: [],
        missing: [],
        totalUnused: 0,
        totalMissing: 0,
        errors: [],
        warnings: [],
      },
      items: [
        {
          update: {
            packagePath: "/tmp/project",
            name: "react",
            kind: "dependencies",
            fromRange: "^18.0.0",
            toRange: "^19.0.0",
            toVersionResolved: "19.0.0",
            diffType: "major",
            filtered: false,
            autofix: true,
          },
          advisories: [],
          peerConflicts: [],
          unusedIssues: [],
          selected: false,
        },
      ],
      degradedSources: [],
    },
    items: [],
    updates: [],
    errors: [],
    warnings: [],
  };

  const rendered = renderReviewResult(review);
  expect(rendered).toContain("No updates matched the active review filters.");
  expect(rendered).toContain("FilterOutcome:");
});

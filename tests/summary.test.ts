import { expect, test } from "bun:test";
import { createSummary, finalizeSummary, resolveFailReason } from "../src/core/summary.js";
import type { PackageUpdate } from "../src/types/index.js";

test("resolveFailReason classifies warm-cache registry failures", () => {
  const failReason = resolveFailReason([], ["Unable to warm react: Registry request failed: 500"], "none", undefined, false);
  expect(failReason).toBe("registry-failure");
});

test("createSummary includes fix-pr defaults", () => {
  const summary = finalizeSummary(
    createSummary({
      scannedPackages: 1,
      totalDependencies: 2,
      checkedDependencies: 2,
      updatesFound: 1,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      errors: [],
      warnings: [],
      durations: {
        totalMs: 10,
        discoveryMs: 2,
        registryMs: 5,
        cacheMs: 1,
      },
    }),
  );

  expect(summary.fixPrApplied).toBe(false);
  expect(summary.fixBranchName).toBe("");
  expect(summary.fixCommitSha).toBe("");
  expect(summary.fixPrBranchesCreated).toBe(0);
  expect(summary.groupedUpdates).toBe(0);
  expect(summary.cooldownSkipped).toBe(0);
  expect(summary.ciProfile).toBe("minimal");
  expect(summary.prLimitHit).toBe(false);
  expect(summary.streamedEvents).toBe(0);
  expect(summary.policyOverridesApplied).toBe(0);
  expect(summary.suggestedCommand).toBeUndefined();
  expect(summary.decisionPlan).toBeUndefined();
});

test("resolveFailReason applies severity threshold for minor", () => {
  const updates: PackageUpdate[] = [
    {
      packagePath: "/tmp/project",
      name: "react",
      kind: "dependencies",
      fromRange: "^18.2.0",
      toRange: "^18.3.0",
      toVersionResolved: "18.3.0",
      diffType: "minor",
      filtered: false,
      autofix: true,
    },
  ];
  const failReason = resolveFailReason(updates, [], "minor", undefined, false);
  expect(failReason).toBe("severity-threshold");
});

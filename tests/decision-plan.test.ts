import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createDecisionPlan,
  filterReviewItemsByFocus,
  readDecisionPlan,
  selectedUpdatesFromPlan,
  writeDecisionPlan,
} from "../src/core/decision-plan.js";
import { upgrade } from "../src/core/upgrade.js";
import type { ReviewItem, ReviewResult } from "../src/types/index.js";

test("decision plan captures selected updates and focus", async () => {
  const review = createReviewResult();
  const selectedItems = [review.items[0]!];
  const plan = createDecisionPlan({
    review,
    selectedItems,
    sourceCommand: "dashboard",
    mode: "review",
    focus: "security",
  });

  expect(plan.focus).toBe("security");
  expect(plan.summary.selectedItems).toBe(1);
  expect(plan.items[0]?.selected).toBe(true);
  expect(plan.items[1]?.selected).toBe(false);
  expect(selectedUpdatesFromPlan(plan)).toHaveLength(1);

  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-plan-"));
  const filePath = path.join(dir, "decision-plan.json");
  await writeDecisionPlan(filePath, plan);

  const loaded = await readDecisionPlan(filePath);
  expect(loaded.contractVersion).toBe("1");
  expect(loaded.items).toHaveLength(2);
});

test("filterReviewItemsByFocus narrows the review queue", () => {
  const review = createReviewResult();
  expect(filterReviewItemsByFocus(review.items, "security")).toHaveLength(1);
  expect(filterReviewItemsByFocus(review.items, "major")).toHaveLength(1);
  expect(filterReviewItemsByFocus(review.items, "blocked")).toHaveLength(1);
});

test("upgrade applies selected updates from a decision plan", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-upgrade-plan-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "plan-fixture",
        version: "1.0.0",
        dependencies: {
          react: "^18.2.0",
          zod: "^3.20.0",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const review = createReviewResult(dir);
  const plan = createDecisionPlan({
    review,
    selectedItems: [review.items[0]!],
    sourceCommand: "dashboard",
    mode: "upgrade",
    focus: "all",
  });
  const planFile = path.join(dir, ".artifacts", "decision-plan.json");
  await writeDecisionPlan(planFile, plan);

  const result = await upgrade({
    cwd: dir,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"],
    ci: false,
    format: "table",
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 16,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: "chore/rainy-updates",
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    fixPrBatchSize: undefined,
    noPrReport: false,
    logLevel: "info",
    groupBy: "none",
    groupMax: undefined,
    cooldownDays: undefined,
    prLimit: undefined,
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
    interactive: false,
    showImpact: false,
    showHomepage: false,
    decisionPlanFile: planFile,
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
    install: false,
    packageManager: "auto",
    sync: false,
    fromPlanFile: planFile,
  });

  const manifest = JSON.parse(
    await readFile(path.join(dir, "package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  expect(result.changed).toBe(true);
  expect(result.summary.decisionPlan).toBe(planFile);
  expect(manifest.dependencies.react).toBe("^19.0.0");
  expect(manifest.dependencies.zod).toBe("^3.20.0");
});

function createReviewResult(projectPath = "/tmp/project"): ReviewResult {
  const items = createReviewItems(projectPath);
  return {
    projectPath,
    target: "latest",
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: items.length,
      checkedDependencies: items.length,
      updatesFound: items.length,
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
      verdict: "review",
      interactiveSession: false,
      riskPackages: 1,
      securityPackages: 1,
      peerConflictPackages: 0,
      licenseViolationPackages: 1,
      privateRegistryPackages: 0,
    },
    analysis: {
      check: {
        projectPath,
        packagePaths: [projectPath],
        packageManager: "npm",
        target: "latest",
        timestamp: new Date(0).toISOString(),
        summary: {} as ReviewResult["summary"],
        updates: items.map((item) => item.update),
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
      items,
      degradedSources: [],
    },
    items,
    updates: items.map((item) => item.update),
    errors: [],
    warnings: [],
  };
}

function createReviewItems(projectPath: string): ReviewItem[] {
  return [
    {
      update: {
        packagePath: projectPath,
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
        autofix: true,
        advisoryCount: 1,
        riskLevel: "high",
        riskScore: 60,
        decisionState: "review",
        workspaceGroup: "root",
      },
      advisories: [
        {
          cveId: "CVE-1",
          packageName: "react",
          currentVersion: "18.2.0",
          severity: "high",
          vulnerableRange: "<19.0.0",
          patchedVersion: "19.0.0",
          title: "Security fix",
          url: "https://example.com",
          sources: ["github"],
        },
      ],
      peerConflicts: [],
      unusedIssues: [],
      selected: true,
    },
    {
      update: {
        packagePath: projectPath,
        name: "zod",
        kind: "dependencies",
        fromRange: "^3.20.0",
        toRange: "^3.21.0",
        toVersionResolved: "3.21.0",
        diffType: "minor",
        filtered: false,
        autofix: true,
        riskLevel: "low",
        riskScore: 10,
        decisionState: "blocked",
        licenseStatus: "denied",
        workspaceGroup: "root",
      },
      advisories: [],
      peerConflicts: [],
      unusedIssues: [],
      selected: false,
    },
  ];
}

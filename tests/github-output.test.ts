import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderGitHubAnnotations, writeGitHubOutput } from "../src/output/github.js";
import type { CheckResult } from "../src/types/index.js";

test("writeGitHubOutput writes key-value outputs", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-gh-output-"));
  const filePath = path.join(dir, "github-output.txt");

  const result: CheckResult = {
    projectPath: dir,
    packagePaths: [dir],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 3,
      checkedDependencies: 3,
      updatesFound: 2,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      failReason: "none",
      errorCounts: { total: 1, offlineCacheMiss: 0, registryFailure: 0, registryAuthFailure: 0, other: 1 },
      warningCounts: { total: 1, staleCache: 0, other: 1 },
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
    },
    updates: [],
    errors: ["x"],
    warnings: ["y"],
  };

  await writeGitHubOutput(filePath, result);
  const content = await readFile(filePath, "utf8");
  expect(content.includes("updates_found=2")).toBe(true);
  expect(content.includes("errors_count=1")).toBe(true);
  expect(content.includes("warnings_count=1")).toBe(true);
  expect(content.includes("fix_pr_applied=0")).toBe(true);
  expect(content.includes("ci_profile=minimal")).toBe(true);
  expect(content.includes("grouped_updates=0")).toBe(true);
});

test("renderGitHubAnnotations emits deterministic sorted output", () => {
  const result: CheckResult = {
    projectPath: "/tmp/project",
    packagePaths: ["/tmp/project"],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 3,
      checkedDependencies: 3,
      updatesFound: 2,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
      failReason: "none",
      errorCounts: { total: 2, offlineCacheMiss: 0, registryFailure: 2, registryAuthFailure: 0, other: 0 },
      warningCounts: { total: 1, staleCache: 0, other: 1 },
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
    },
    updates: [
      {
        packagePath: "/tmp/project-b",
        name: "zod",
        kind: "dependencies",
        fromRange: "^3.0.0",
        toRange: "^3.1.0",
        toVersionResolved: "3.1.0",
        diffType: "minor",
        filtered: false,
        autofix: true,
      },
      {
        packagePath: "/tmp/project-a",
        name: "axios",
        kind: "dependencies",
        fromRange: "^1.0.0",
        toRange: "^1.1.0",
        toVersionResolved: "1.1.0",
        diffType: "minor",
        filtered: false,
        autofix: true,
      },
    ],
    errors: ["z-error", "a-error"],
    warnings: ["b-warning"],
  };

  const output = renderGitHubAnnotations(result).split("\n");
  expect(output[0]?.includes("axios")).toBe(true);
  expect(output[1]?.includes("zod")).toBe(true);
  expect(output[2]).toBe("::warning title=Rainy Updates::b-warning");
  expect(output[3]).toBe("::error title=Rainy Updates::a-error");
  expect(output[4]).toBe("::error title=Rainy Updates::z-error");
});

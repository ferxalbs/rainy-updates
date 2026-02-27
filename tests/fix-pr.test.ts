import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { applyFixPr } from "../src/core/fix-pr.js";
import type { CheckResult, RunOptions } from "../src/types/index.js";

test("applyFixPr supports dry-run branch preparation", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-fix-pr-"));
  await run("git", ["init"], dir);

  const options: RunOptions = {
    cwd: dir,
    target: "latest",
    cacheTtlSeconds: 60,
    includeKinds: ["dependencies"],
    ci: false,
    format: "json",
    logLevel: "info",
    workspace: false,
    concurrency: 2,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    fixPr: true,
    fixBranch: "chore/rainy-updates-test",
    fixDryRun: true,
    fixPrNoCheckout: false,
    noPrReport: true,
    groupBy: "none",
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
  };

  const result: CheckResult = {
    projectPath: dir,
    packagePaths: [dir],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 1,
      checkedDependencies: 1,
      updatesFound: 1,
      upgraded: 1,
      skipped: 0,
      warmedPackages: 0,
      failReason: "none",
      errorCounts: { total: 0, offlineCacheMiss: 0, registryFailure: 0, registryAuthFailure: 0, other: 0 },
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
    },
    updates: [
      {
        packagePath: dir,
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
        autofix: true,
      },
    ],
    errors: [],
    warnings: [],
  };

  const applied = await applyFixPr(options, result, []);
  expect(applied.applied).toBe(false);
  expect(applied.branchName).toBe("chore/rainy-updates-test");
});

test("applyFixPr skips updates marked as autofix false", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-fix-pr-no-autofix-"));
  await run("git", ["init"], dir);

  const options: RunOptions = {
    cwd: dir,
    target: "latest",
    cacheTtlSeconds: 60,
    includeKinds: ["dependencies"],
    ci: false,
    format: "json",
    logLevel: "info",
    workspace: false,
    concurrency: 2,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    fixPr: true,
    fixBranch: "chore/rainy-updates-test",
    fixDryRun: false,
    fixPrNoCheckout: false,
    noPrReport: true,
    groupBy: "none",
    onlyChanged: false,
    ciProfile: "minimal",
    lockfileMode: "preserve",
  };

  const result: CheckResult = {
    projectPath: dir,
    packagePaths: [dir],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      contractVersion: "2",
      scannedPackages: 1,
      totalDependencies: 1,
      checkedDependencies: 1,
      updatesFound: 1,
      upgraded: 1,
      skipped: 0,
      warmedPackages: 0,
      failReason: "none",
      errorCounts: { total: 0, offlineCacheMiss: 0, registryFailure: 0, registryAuthFailure: 0, other: 0 },
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
    },
    updates: [
      {
        packagePath: dir,
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        filtered: false,
        autofix: false,
      },
    ],
    errors: [],
    warnings: [],
  };

  const applied = await applyFixPr(options, result, []);
  expect(applied.applied).toBe(false);
});

async function run(command: string, args: string[], cwd: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with code ${code ?? "unknown"}`));
    });
  });
}

import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRunId, writeArtifactManifest } from "../src/core/artifacts.js";
import type { CheckResult, CheckOptions } from "../src/types/index.js";

function createOptions(cwd: string): CheckOptions {
  return {
    cwd,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 60,
    includeKinds: ["dependencies"],
    ci: true,
    format: "json",
    workspace: false,
    jsonFile: path.join(cwd, ".artifacts", "deps.json"),
    githubOutputFile: path.join(cwd, ".artifacts", "github.txt"),
    sarifFile: path.join(cwd, ".artifacts", "deps.sarif"),
    concurrency: 4,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: false,
    stream: false,
    policyFile: undefined,
    prReportFile: path.join(cwd, ".artifacts", "deps.md"),
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
    ciProfile: "strict",
    lockfileMode: "preserve",
    interactive: false,
    showImpact: false,
    showHomepage: false,
    decisionPlanFile: path.join(cwd, ".artifacts", "decision-plan.json"),
    verify: "test",
    testCommand: "npm test",
    verificationReportFile: path.join(cwd, ".artifacts", "verify.json"),
    ciGate: "review",
  };
}

function createResult(cwd: string): CheckResult {
  return {
    projectPath: cwd,
    packagePaths: [cwd],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date(0).toISOString(),
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
      ciProfile: "strict",
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
      blockedPackages: 0,
      reviewPackages: 1,
      monitorPackages: 0,
      decisionPackages: 1,
      releaseVolatilityPackages: 0,
      engineConflictPackages: 0,
      degradedSources: [],
      cacheBackend: "sqlite",
      binaryRecommended: false,
      gaReady: true,
    },
    updates: [
      {
        packagePath: cwd,
        workspaceGroup: path.basename(cwd),
        name: "react",
        kind: "dependencies",
        fromRange: "^18.0.0",
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
}

test("createRunId is deterministic for the same command and result", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-run-id-"));
  const options = createOptions(cwd);
  const result = createResult(cwd);

  const first = createRunId("check", options, result);
  const second = createRunId("check", options, result);

  expect(first).toBe(second);
  expect(first.length).toBe(16);
});

test("writeArtifactManifest writes a manifest with the expected output paths", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "rainy-artifacts-"));
  const options = createOptions(cwd);
  const result = createResult(cwd);
  result.summary.runId = createRunId("ci", options, result);

  const manifest = await writeArtifactManifest("ci", options, result);

  expect(manifest).not.toBeNull();
  expect(manifest?.runId).toBe(result.summary.runId);
  expect(manifest?.artifactManifestPath.endsWith(`${result.summary.runId}.json`)).toBe(true);

  const content = await readFile(manifest!.artifactManifestPath, "utf8");
  const parsed = JSON.parse(content) as { outputs: Record<string, string>; command: string };
  expect(parsed.command).toBe("ci");
  expect(parsed.outputs.jsonFile).toBe(options.jsonFile!);
  expect(parsed.outputs.githubOutputFile).toBe(options.githubOutputFile!);
  expect(parsed.outputs.sarifFile).toBe(options.sarifFile!);
  expect(parsed.outputs.prReportFile).toBe(options.prReportFile!);
  expect(parsed.outputs.verificationReportFile).toBe(options.verificationReportFile!);
});

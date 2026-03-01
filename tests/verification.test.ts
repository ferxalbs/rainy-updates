import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runVerification } from "../src/core/verification.js";
import { runCi } from "../src/core/ci.js";
import { writeDecisionPlan } from "../src/core/decision-plan.js";
import type { DecisionPlan, CheckOptions } from "../src/types/index.js";

test("runVerification writes a passing test report", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-verify-"));
  const reportFile = path.join(dir, ".artifacts", "verify.json");

  const result = await runVerification({
    cwd: dir,
    verify: "test",
    testCommand: `${process.execPath} -e "process.exit(0)"`,
    verificationReportFile: reportFile,
    packageManager: "auto",
  });

  expect(result.passed).toBe(true);
  expect(result.checks[0]?.name).toBe("test");

  const report = JSON.parse(await readFile(reportFile, "utf8")) as {
    passed: boolean;
    checks: Array<{ passed: boolean }>;
  };
  expect(report.passed).toBe(true);
  expect(report.checks[0]?.passed).toBe(true);
});

test("runCi upgrade gate replays a decision plan and writes verification metadata", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-ci-upgrade-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "ci-upgrade-fixture",
        version: "1.0.0",
        dependencies: {
          react: "^18.2.0",
        },
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  const planFile = path.join(dir, ".artifacts", "decision-plan.json");
  const verificationReportFile = path.join(dir, ".artifacts", "verify.json");
  const plan: DecisionPlan = {
    contractVersion: "1",
    createdAt: new Date().toISOString(),
    sourceCommand: "ci",
    mode: "upgrade",
    focus: "all",
    projectPath: dir,
    target: "latest",
    interactiveSurface: "dashboard",
    summary: {
      totalItems: 1,
      selectedItems: 1,
    },
    items: [
      {
        packagePath: dir,
        name: "react",
        kind: "dependencies",
        fromRange: "^18.2.0",
        toRange: "^19.0.0",
        toVersionResolved: "19.0.0",
        diffType: "major",
        selected: true,
      },
    ],
  };
  await writeDecisionPlan(planFile, plan);

  const result = await runCi({
    cwd: dir,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 3600,
    includeKinds: ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"],
    ci: true,
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
    verify: "test",
    testCommand: `${process.execPath} -e "process.exit(0)"`,
    verificationReportFile,
    ciGate: "upgrade",
  } satisfies CheckOptions);

  const manifest = JSON.parse(
    await readFile(path.join(dir, "package.json"), "utf8"),
  ) as { dependencies: Record<string, string> };
  expect(result.summary.decisionPlan).toBe(planFile);
  expect(result.summary.verificationState).toBe("passed");
  expect(manifest.dependencies.react).toBe("^19.0.0");
});

import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { check } from "../src/core/check.js";

test("offline mode reports cache miss error", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-offline-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({
      name: "offline-test",
      dependencies: {
        "rainy-offline-fixture-package": "^1.0.0",
      },
    }),
    "utf8",
  );

  const result = await check({
    cwd: dir,
    target: "latest",
    filter: undefined,
    reject: undefined,
    cacheTtlSeconds: 60,
    includeKinds: ["dependencies"],
    ci: false,
    format: "json",
    logLevel: "info",
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 2,
    registryTimeoutMs: 8000,
    registryRetries: 3,
    offline: true,
    stream: false,
    policyFile: undefined,
    prReportFile: undefined,
    failOn: "none",
    maxUpdates: undefined,
    fixPr: false,
    fixBranch: undefined,
    fixCommitMessage: undefined,
    fixDryRun: false,
    fixPrNoCheckout: false,
    noPrReport: false,
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
    decisionPlanFile: undefined,
    verify: "none",
    testCommand: undefined,
    verificationReportFile: undefined,
    ciGate: "check",
  });

  expect(
    result.errors.some((item) =>
      item.includes("Offline cache miss for rainy-offline-fixture-package"),
    ),
  ).toBe(true);
});

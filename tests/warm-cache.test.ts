import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { warmCache } from "../src/core/warm-cache.js";

test("warmCache reports misses in offline mode", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-warm-cache-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "sample", dependencies: { lodash: "^4.17.0" } }),
    "utf8",
  );

  const result = await warmCache({
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
    concurrency: 4,
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

  expect(result.summary.warmedPackages).toBe(0);
  expect(result.errors.some((item) => item.includes("Offline cache miss for lodash"))).toBe(true);
});

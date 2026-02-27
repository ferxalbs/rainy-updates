import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { warmCache } from "../src/core/warm-cache.js";

test("warmCache reports misses in offline mode", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-warm-cache-"));
  await writeFile(
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
    workspace: false,
    jsonFile: undefined,
    githubOutputFile: undefined,
    sarifFile: undefined,
    concurrency: 4,
    offline: true,
    policyFile: undefined,
    prReportFile: undefined,
  });

  expect(result.summary.warmedPackages).toBe(0);
  expect(result.errors.some((item) => item.includes("Offline cache miss for lodash"))).toBe(true);
});

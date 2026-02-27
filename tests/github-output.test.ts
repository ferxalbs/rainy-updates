import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeGitHubOutput } from "../src/output/github.js";
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
      scannedPackages: 1,
      totalDependencies: 3,
      checkedDependencies: 3,
      updatesFound: 2,
      upgraded: 0,
      skipped: 0,
      warmedPackages: 0,
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
});

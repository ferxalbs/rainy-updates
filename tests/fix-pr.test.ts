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
    workspace: false,
    concurrency: 2,
    offline: false,
    fixPr: true,
    fixBranch: "chore/rainy-updates-test",
    fixDryRun: true,
    noPrReport: true,
  };

  const result: CheckResult = {
    projectPath: dir,
    packagePaths: [dir],
    packageManager: "npm",
    target: "latest",
    timestamp: new Date().toISOString(),
    summary: {
      scannedPackages: 1,
      totalDependencies: 1,
      checkedDependencies: 1,
      updatesFound: 1,
      upgraded: 1,
      skipped: 0,
      warmedPackages: 0,
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
      },
    ],
    errors: [],
    warnings: [],
  };

  const applied = await applyFixPr(options, result, []);
  expect(applied.applied).toBe(false);
  expect(applied.branchName).toBe("chore/rainy-updates-test");
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

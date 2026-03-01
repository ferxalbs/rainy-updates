import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runGa } from "../src/commands/ga/runner.js";

test("runGa reports readiness details for a basic npm project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-ga-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "ga-fixture", version: "1.0.0" }, null, 2),
    "utf8",
  );
  await writeFile(path.join(dir, "package-lock.json"), "{}", "utf8");
  await writeFile(path.join(dir, "README.md"), "# fixture\n", "utf8");
  await writeFile(path.join(dir, "CHANGELOG.md"), "# changelog\n", "utf8");

  const result = await runGa({ cwd: dir, workspace: false });

  expect(result.packageManager).toBe("npm");
  expect(result.workspacePackages).toBe(1);
  expect(result.checks.some((check) => check.name === "lockfile" && check.status === "pass")).toBe(true);
});

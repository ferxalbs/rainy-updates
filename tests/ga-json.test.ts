import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runGa } from "../src/commands/ga/runner.js";

test("runGa writes JSON output when requested", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-ga-json-"));
  const jsonFile = path.join(dir, ".artifacts", "ga.json");
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "ga-json-fixture", version: "1.0.0" }, null, 2),
    "utf8",
  );
  await writeFile(path.join(dir, "package-lock.json"), "{}", "utf8");
  await writeFile(path.join(dir, "README.md"), "# fixture\n", "utf8");
  await writeFile(path.join(dir, "CHANGELOG.md"), "# changelog\n", "utf8");

  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    await runGa({ cwd: dir, workspace: false, jsonFile });
  } finally {
    process.stdout.write = stdoutWrite;
  }

  const content = await readFile(jsonFile, "utf8");
  const parsed = JSON.parse(content) as { ready: boolean; checks: Array<{ name: string }> };
  expect(parsed.ready).toBe(true);
  expect(parsed.checks.some((check) => check.name === "lockfile")).toBe(true);
});

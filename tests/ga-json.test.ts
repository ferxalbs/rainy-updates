import { expect, test } from "bun:test";
import { $ } from "bun";
// readFile, writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { runGa } from "../src/commands/ga/runner.js";

test("runGa writes JSON output when requested", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-ga-json-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  const jsonFile = path.join(dir, ".artifacts", "ga.json");
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "ga-json-fixture", version: "1.0.0" }, null, 2),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "package-lock.json"), "{}");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "README.md"), "# fixture\n");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "CHANGELOG.md"), "# changelog\n");

  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (() => true) as typeof process.stdout.write;
  try {
    await runGa({ cwd: dir, workspace: false, jsonFile });
  } finally {
    process.stdout.write = stdoutWrite;
  }

  const content = await Bun.file(jsonFile).text();
  const parsed = JSON.parse(content) as { ready: boolean; checks: Array<{ name: string }> };
  expect(parsed.ready).toBe(true);
  expect(parsed.checks.some((check) => check.name === "lockfile")).toBe(true);
  expect(parsed.checks.some((check) => check.name === "runtime-artifacts")).toBe(
    true,
  );
});

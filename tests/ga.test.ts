import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { runGa } from "../src/commands/ga/runner.js";

test("runGa reports readiness details for a basic npm project", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-ga-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "ga-fixture", version: "1.0.0" }, null, 2),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "package-lock.json"), "{}");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "README.md"), "# fixture\n");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "CHANGELOG.md"), "# changelog\n");

  const result = await runGa({ cwd: dir, workspace: false });

  expect(result.packageManager).toBe("npm");
  expect(result.workspacePackages).toBe(1);
  expect(result.checks.some((check) => check.name === "lockfile" && check.status === "pass")).toBe(true);
  expect(
    result.checks.some(
      (check) => check.name === "runtime-artifacts" && check.status === "warn",
    ),
  ).toBe(true);
  expect(
    result.checks.some(
      (check) => check.name === "automation-entrypoints" && check.status === "warn",
    ),
  ).toBe(true);
});

test("runGa detects package manager from packageManager field", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-ga-pm-field-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "ga-field-fixture",
        version: "1.0.0",
        packageManager: "yarn@4.6.0",
      },
      null,
      2,
    ),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "README.md"), "# fixture\n");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "CHANGELOG.md"), "# changelog\n");

  const result = await runGa({ cwd: dir, workspace: false });

  expect(result.packageManager).toBe("yarn");
  expect(
    result.checks.some(
      (check) =>
        check.name === "package-manager" &&
        check.detail.includes("packageManager-field") &&
        check.detail.includes("yarn@4.6.0"),
    ),
  ).toBe(true);
});

test("runGa recognizes Makefile-backed automation entrypoints", async () => {
  const dir = await (async () => { const d = path.join(os.tmpdir(), "rainy-ga-make-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "ga-make-fixture",
        version: "1.0.0",
        scripts: {
          build: "bun run build",
          check: "bun run check",
          "test:prod": "bun run test:prod",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "Makefile"), "check:\n\tbun run check\n");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "README.md"), "# fixture\n");
  await (async (p, c) => await Bun.write(p, c))(path.join(dir, "CHANGELOG.md"), "# changelog\n");

  const result = await runGa({ cwd: dir, workspace: false });

  expect(
    result.checks.some(
      (check) =>
        check.name === "automation-entrypoints" && check.status === "pass",
    ),
  ).toBe(true);
});

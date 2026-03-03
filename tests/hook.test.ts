import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseCliArgs } from "../src/core/options.js";
import { runHook } from "../src/commands/hook/runner.js";

test("parseCliArgs supports hook command", async () => {
  const parsed = await parseCliArgs(["hook", "install"]);
  expect(parsed.command).toBe("hook");
  if (parsed.command === "hook") {
    expect(parsed.options.action).toBe("install");
  }
});

test("runHook installs, inspects, and uninstalls managed hooks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-hook-"));
  await writeFile(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "hook-fixture", version: "1.0.0" }, null, 2) + "\n",
    "utf8",
  );

  runGit(dir, ["init"]);
  runGit(dir, ["config", "user.email", "tests@rainy.dev"]);
  runGit(dir, ["config", "user.name", "Rainy Tests"]);

  const installResult = await runHook({ cwd: dir, action: "install" });
  expect(installResult.installed).toEqual(["pre-commit", "pre-push"]);

  const preCommit = await readFile(path.join(dir, ".git", "hooks", "pre-commit"), "utf8");
  const prePush = await readFile(path.join(dir, ".git", "hooks", "pre-push"), "utf8");
  expect(preCommit.includes("rainy-updates managed hook")).toBe(true);
  expect(preCommit.includes("unused --workspace --staged")).toBe(true);
  expect(prePush.includes("audit --workspace --affected")).toBe(true);

  const doctorResult = await runHook({ cwd: dir, action: "doctor" });
  expect(doctorResult.checked.every((check) => check.status === "managed")).toBe(true);

  const uninstallResult = await runHook({ cwd: dir, action: "uninstall" });
  expect(uninstallResult.removed).toEqual(["pre-commit", "pre-push"]);
});

function runGit(cwd: string, args: string[]): void {
  const proc = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(stderr || `git ${args.join(" ")} failed`);
  }
}

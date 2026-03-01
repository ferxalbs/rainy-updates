import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseCliArgs } from "../src/core/options.js";

test("parseCliArgs defaults to check command", async () => {
  const parsed = await parseCliArgs(["--format", "json"]);
  expect(parsed.command).toBe("check");
  if (parsed.command === "check") {
    expect(parsed.options.format).toBe("json");
  }
});

test("parseCliArgs supports upgrade install and pm", async () => {
  const parsed = await parseCliArgs([
    "upgrade",
    "--install",
    "--pm",
    "pnpm",
    "--workspace",
    "--sync",
    "--concurrency",
    "8",
    "--registry-timeout-ms",
    "12000",
    "--registry-retries",
    "5",
    "--offline",
    "--stream",
    "--lockfile-mode",
    "update",
    "--format",
    "github",
  ]);
  expect(parsed.command).toBe("upgrade");
  if (parsed.command === "upgrade") {
    expect(parsed.options.install).toBe(true);
    expect(parsed.options.packageManager).toBe("pnpm");
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.sync).toBe(true);
    expect(parsed.options.concurrency).toBe(8);
    expect(parsed.options.registryTimeoutMs).toBe(12000);
    expect(parsed.options.registryRetries).toBe(5);
    expect(parsed.options.offline).toBe(true);
    expect(parsed.options.stream).toBe(true);
    expect(parsed.options.format).toBe("github");
    expect(parsed.options.lockfileMode).toBe("update");
  }
});

test("parseCliArgs supports warm-cache and init-ci", async () => {
  const warm = await parseCliArgs(["warm-cache", "--offline", "--policy-file", "policy.json"]);
  expect(warm.command).toBe("warm-cache");
  if (warm.command === "warm-cache") {
    expect(warm.options.offline).toBe(true);
    expect(warm.options.policyFile?.endsWith("policy.json")).toBe(true);
  }

  const init = await parseCliArgs(["init-ci", "--force", "--mode", "minimal", "--schedule", "daily"]);
  expect(init.command).toBe("init-ci");
  if (init.command === "init-ci") {
    expect(init.options.force).toBe(true);
    expect(init.options.mode).toBe("minimal");
    expect(init.options.schedule).toBe("daily");
  }
});

test("parseCliArgs supports baseline command and ci gating flags", async () => {
  const parsed = await parseCliArgs([
    "baseline",
    "--save",
    "--file",
    ".cache/baseline.json",
    "--workspace",
    "--dep-kinds",
    "deps,dev",
  ]);
  expect(parsed.command).toBe("baseline");
  if (parsed.command === "baseline") {
    expect(parsed.options.action).toBe("save");
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.includeKinds).toEqual(["dependencies", "devDependencies"]);
    expect(parsed.options.filePath.endsWith(".cache/baseline.json")).toBe(true);
  }

  const checkParsed = await parseCliArgs(["check", "--fail-on", "minor", "--max-updates", "5"]);
  expect(checkParsed.command).toBe("check");
  if (checkParsed.command === "check") {
    expect(checkParsed.options.failOn).toBe("minor");
    expect(checkParsed.options.maxUpdates).toBe(5);
  }
});

test("parseCliArgs supports ci command orchestration flags", async () => {
  const parsed = await parseCliArgs([
    "ci",
    "--mode",
    "strict",
    "--group-by",
    "scope",
    "--group-max",
    "12",
    "--cooldown-days",
    "7",
    "--pr-limit",
    "20",
    "--fix-pr-batch-size",
    "3",
    "--only-changed",
  ]);
  expect(parsed.command).toBe("ci");
  if (parsed.command === "ci") {
    expect(parsed.options.ciProfile).toBe("strict");
    expect(parsed.options.groupBy).toBe("scope");
    expect(parsed.options.groupMax).toBe(12);
    expect(parsed.options.cooldownDays).toBe(7);
    expect(parsed.options.prLimit).toBe(20);
    expect(parsed.options.fixPrBatchSize).toBe(3);
    expect(parsed.options.onlyChanged).toBe(true);
  }
});

test("parseCliArgs rejects unknown command", async () => {
  await expect(parseCliArgs(["deploy-updates"])).rejects.toThrow("Unknown command");
});

test("parseCliArgs rejects unknown options", async () => {
  await expect(parseCliArgs(["check", "--does-not-exist"])).rejects.toThrow("Unknown option");
});

test("parseCliArgs supports fix-pr options and default report path", async () => {
  const parsed = await parseCliArgs(["upgrade", "--fix-pr", "--fix-branch", "chore/dep-bot", "--fix-dry-run"]);
  expect(parsed.command).toBe("upgrade");
  if (parsed.command === "upgrade") {
    expect(parsed.options.fixPr).toBe(true);
    expect(parsed.options.fixBranch).toBe("chore/dep-bot");
    expect(parsed.options.fixDryRun).toBe(true);
    expect(parsed.options.prReportFile?.endsWith(".artifacts/deps-report.md")).toBe(true);
  }
});

test("parseCliArgs honors no-pr-report over report defaults", async () => {
  const parsed = await parseCliArgs(["check", "--fix-pr", "--no-pr-report"]);
  expect(parsed.command).toBe("check");
  if (parsed.command === "check") {
    expect(parsed.options.fixPr).toBe(true);
    expect(parsed.options.noPrReport).toBe(true);
    expect(parsed.options.prReportFile).toBeUndefined();
  }
});

test("parseCliArgs resolves output paths from final cwd", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-options-cwd-"));
  const parsed = await parseCliArgs(["--json-file", "out/result.json", "--cwd", dir]);
  expect(parsed.command).toBe("check");
  if (parsed.command === "check") {
    expect(parsed.options.jsonFile).toBe(path.join(dir, "out", "result.json"));
  }
});

test("parseCliArgs supports review command filters", async () => {
  const parsed = await parseCliArgs([
    "review",
    "--workspace",
    "--interactive",
    "--security-only",
    "--risk",
    "high",
    "--diff",
    "major",
  ]);
  expect(parsed.command).toBe("review");
  if (parsed.command === "review") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.interactive).toBe(true);
    expect(parsed.options.securityOnly).toBe(true);
    expect(parsed.options.risk).toBe("high");
    expect(parsed.options.diff).toBe("major");
  }
});

test("parseCliArgs supports doctor command", async () => {
  const parsed = await parseCliArgs(["doctor", "--workspace", "--verdict-only"]);
  expect(parsed.command).toBe("doctor");
  if (parsed.command === "doctor") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.verdictOnly).toBe(true);
  }
});

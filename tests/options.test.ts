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
    "--from-plan",
    "artifacts/decision-plan.json",
    "--verify",
    "install,test",
    "--test-command",
    "bun test",
    "--verification-report-file",
    "artifacts/verify.json",
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
    expect(parsed.options.fromPlanFile?.endsWith("artifacts/decision-plan.json")).toBe(true);
    expect(parsed.options.verify).toBe("install,test");
    expect(parsed.options.testCommand).toBe("bun test");
    expect(parsed.options.verificationReportFile?.endsWith("artifacts/verify.json")).toBe(true);
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
    "--gate",
    "upgrade",
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
    "--affected",
    "--base",
    "origin/main",
    "--head",
    "HEAD",
    "--verify",
    "test",
    "--test-command",
    "npm test",
  ]);
  expect(parsed.command).toBe("ci");
  if (parsed.command === "ci") {
    expect(parsed.options.ciProfile).toBe("strict");
    expect(parsed.options.ciGate).toBe("upgrade");
    expect(parsed.options.groupBy).toBe("scope");
    expect(parsed.options.groupMax).toBe(12);
    expect(parsed.options.cooldownDays).toBe(7);
    expect(parsed.options.prLimit).toBe(20);
    expect(parsed.options.fixPrBatchSize).toBe(3);
    expect(parsed.options.onlyChanged).toBe(true);
    expect(parsed.options.affected).toBe(true);
    expect(parsed.options.baseRef).toBe("origin/main");
    expect(parsed.options.headRef).toBe("HEAD");
    expect(parsed.options.verify).toBe("test");
    expect(parsed.options.testCommand).toBe("npm test");
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
    "--only-changed",
    "--since",
    "origin/main",
    "--interactive",
    "--security-only",
    "--show-changelog",
    "--risk",
    "high",
    "--diff",
    "major",
  ]);
  expect(parsed.command).toBe("review");
  if (parsed.command === "review") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.onlyChanged).toBe(true);
    expect(parsed.options.sinceRef).toBe("origin/main");
    expect(parsed.options.interactive).toBe(true);
    expect(parsed.options.securityOnly).toBe(true);
    expect(parsed.options.showChangelog).toBe(true);
    expect(parsed.options.risk).toBe("high");
    expect(parsed.options.diff).toBe("major");
  }
});

test("parseCliArgs supports doctor command", async () => {
  const parsed = await parseCliArgs([
    "doctor",
    "--workspace",
    "--affected",
    "--staged",
    "--verdict-only",
    "--include-changelog",
    "--agent-report",
  ]);
  expect(parsed.command).toBe("doctor");
  if (parsed.command === "doctor") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.affected).toBe(true);
    expect(parsed.options.staged).toBe(true);
    expect(parsed.options.verdictOnly).toBe(true);
    expect(parsed.options.includeChangelog).toBe(true);
    expect(parsed.options.agentReport).toBe(true);
  }
});

test("parseCliArgs supports dashboard command", async () => {
  const parsed = await parseCliArgs([
    "dashboard",
    "--workspace",
    "--view",
    "health",
    "--mode",
    "upgrade",
    "--focus",
    "security",
    "--apply-selected",
    "--plan-file",
    "plans/queue.json",
    "--verify",
    "test",
    "--test-command",
    "npm test",
  ]);
  expect(parsed.command).toBe("dashboard");
  if (parsed.command === "dashboard") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.view).toBe("health");
    expect(parsed.options.mode).toBe("upgrade");
    expect(parsed.options.focus).toBe("security");
    expect(parsed.options.applySelected).toBe(true);
    expect(parsed.options.decisionPlanFile?.endsWith("plans/queue.json")).toBe(true);
    expect(parsed.options.verify).toBe("test");
    expect(parsed.options.testCommand).toBe("npm test");
  }
});

test("parseCliArgs supports mcp command", async () => {
  const parsed = await parseCliArgs([
    "mcp",
    "--workspace",
    "--tool-timeout-ms",
    "15000",
    "--port",
    "3741",
    "--auth-token",
    "secret",
  ]);
  expect(parsed.command).toBe("mcp");
  if (parsed.command === "mcp") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.toolTimeoutMs).toBe(15000);
    expect(parsed.options.transport).toBe("http");
    expect(parsed.options.port).toBe(3741);
    expect(parsed.options.authToken).toBe("secret");
  }
});

test("parseCliArgs supports explain command", async () => {
  const parsed = await parseCliArgs([
    "explain",
    "react",
    "--from",
    "18.2.0",
    "--to",
    "19.0.0",
    "--format",
    "json",
  ]);
  expect(parsed.command).toBe("explain");
  if (parsed.command === "explain") {
    expect(parsed.options.packageName).toBe("react");
    expect(parsed.options.fromVersion).toBe("18.2.0");
    expect(parsed.options.toVersion).toBe("19.0.0");
    expect(parsed.options.format).toBe("json");
  }
});

test("parseCliArgs supports predict command", async () => {
  const packageParsed = await parseCliArgs([
    "predict",
    "react",
    "--format",
    "json",
  ]);
  expect(packageParsed.command).toBe("predict");
  if (packageParsed.command === "predict") {
    expect(packageParsed.options.packageName).toBe("react");
    expect(packageParsed.options.format).toBe("json");
  }

  const workspaceParsed = await parseCliArgs(["predict", "--workspace"]);
  expect(workspaceParsed.command).toBe("predict");
  if (workspaceParsed.command === "predict") {
    expect(workspaceParsed.options.workspace).toBe(true);
  }
});

test("parseCliArgs supports self-update command", async () => {
  const parsed = await parseCliArgs([
    "self-update",
    "--apply",
    "--yes",
    "--pm",
    "pnpm",
    "--json-file",
    ".artifacts/self-update.json",
  ]);
  expect(parsed.command).toBe("self-update");
  if (parsed.command === "self-update") {
    expect(parsed.options.action).toBe("apply");
    expect(parsed.options.yes).toBe(true);
    expect(parsed.options.packageManager).toBe("pnpm");
    expect(parsed.options.jsonFile?.endsWith(".artifacts/self-update.json")).toBe(true);
  }
});

test("parseCliArgs supports watch command", async () => {
  const parsed = await parseCliArgs([
    "watch",
    "stop",
    "--workspace",
    "--interval",
    "6h",
    "--notify",
    "slack",
    "--webhook",
    "https://example.com/hook",
  ]);
  expect(parsed.command).toBe("watch");
  if (parsed.command === "watch") {
    expect(parsed.options.action).toBe("stop");
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.intervalMs).toBe(6 * 60 * 60 * 1000);
    expect(parsed.options.notify).toBe("slack");
    expect(parsed.options.webhook).toBe("https://example.com/hook");
  }
});

test("parseCliArgs supports ga command", async () => {
  const parsed = await parseCliArgs(["ga", "--workspace", "--json-file", "ga.json"]);
  expect(parsed.command).toBe("ga");
  if (parsed.command === "ga") {
    expect(parsed.options.workspace).toBe(true);
    expect(parsed.options.jsonFile?.endsWith("ga.json")).toBe(true);
  }
});

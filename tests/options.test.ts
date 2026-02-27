import { expect, test } from "bun:test";
import { parseCliArgs } from "../src/core/options.js";

test("parseCliArgs defaults to check command", async () => {
  const parsed = await parseCliArgs(["--format", "json"]);
  expect(parsed.command).toBe("check");
  expect(parsed.options.format).toBe("json");
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
    "--offline",
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
    expect(parsed.options.offline).toBe(true);
    expect(parsed.options.format).toBe("github");
  }
});

test("parseCliArgs supports warm-cache and init-ci", async () => {
  const warm = await parseCliArgs(["warm-cache", "--offline", "--policy-file", "policy.json"]);
  expect(warm.command).toBe("warm-cache");
  if (warm.command === "warm-cache") {
    expect(warm.options.offline).toBe(true);
    expect(warm.options.policyFile?.endsWith("policy.json")).toBe(true);
  }

  const init = await parseCliArgs(["init-ci", "--force"]);
  expect(init.command).toBe("init-ci");
  if (init.command === "init-ci") {
    expect(init.options.force).toBe(true);
  }
});

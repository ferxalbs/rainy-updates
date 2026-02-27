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
    expect(parsed.options.format).toBe("github");
  }
});

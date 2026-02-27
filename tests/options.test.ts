import { expect, test } from "bun:test";
import { parseCliArgs } from "../src/core/options.js";

test("parseCliArgs defaults to check command", () => {
  const parsed = parseCliArgs(["--format", "json"]);
  expect(parsed.command).toBe("check");
  expect(parsed.options.format).toBe("json");
});

test("parseCliArgs supports upgrade install and pm", () => {
  const parsed = parseCliArgs(["upgrade", "--install", "--pm", "pnpm"]);
  expect(parsed.command).toBe("upgrade");
  if (parsed.command === "upgrade") {
    expect(parsed.options.install).toBe(true);
    expect(parsed.options.packageManager).toBe("pnpm");
  }
});

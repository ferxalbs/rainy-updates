import { expect, test } from "bun:test";
import { renderHelp } from "../src/bin/help.js";

test("renderHelp returns command-specific help", () => {
  const output = renderHelp("doctor");
  expect(output).toContain("rainy-updates doctor [options]");
  expect(output).toContain("--verdict-only");
  expect(output).toContain("--include-changelog");
});

test("renderHelp returns global help for unknown command context", () => {
  const output = renderHelp(undefined);
  expect(output).toContain("rainy-updates (rup / rainy-up) <command> [options]");
  expect(output).toContain("check       Detect candidate updates");
  expect(output).toContain("--version, -v");
});

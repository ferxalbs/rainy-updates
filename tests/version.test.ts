import { expect, test } from "bun:test";
import { CLI_VERSION } from "../src/generated/version.js";

test("CLI_VERSION matches package.json version", async () => {
  const packageJson = (await Bun.file(new URL("../package.json", import.meta.url)).json()) as {
    version?: string;
  };
  const packageVersion = packageJson.version ?? "";

  expect(packageVersion.length).toBeGreaterThan(0);
  expect(CLI_VERSION).toBe(packageVersion);
});

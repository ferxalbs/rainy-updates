import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../src/config/loader.js";

test("loadConfig reads .rainyupdatesrc", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-updates-config-"));
  await writeFile(path.join(root, ".rainyupdatesrc"), JSON.stringify({ target: "minor", workspace: true }), "utf8");

  const config = await loadConfig(root);
  expect(config.target).toBe("minor");
  expect(config.workspace).toBe(true);
});

test("loadConfig validates MCP and webhook config", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-updates-config-"));
  await writeFile(
    path.join(root, ".rainyupdatesrc.json"),
    JSON.stringify({
      mcp: { cwd: "./workspace", transport: "stdio", toolTimeoutMs: 5000 },
      webhooks: [{ event: "check.complete", url: "https://example.com/hook" }],
    }),
    "utf8",
  );

  const config = await loadConfig(root);
  expect(config.mcp?.cwd).toBe("./workspace");
  expect(config.mcp?.transport).toBe("stdio");
  expect(config.webhooks?.[0]?.event).toBe("check.complete");
});

test("loadConfig rejects invalid config schema", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "rainy-updates-config-"));
  await writeFile(
    path.join(root, ".rainyupdatesrc"),
    JSON.stringify({ webhooks: [{ event: "not-real", url: "bad-url" }] }),
    "utf8",
  );

  await expect(loadConfig(root)).rejects.toThrow("Invalid config");
});

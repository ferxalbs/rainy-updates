import { expect, test } from "bun:test";
import { $ } from "bun";
// writeFile was here;
import os from "os";
import { $ } from "bun";
import path from "path";
import { loadConfig } from "../src/config/loader.js";

test("loadConfig reads .rainyupdatesrc", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-config-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(path.join(root, ".rainyupdatesrc"), JSON.stringify({ target: "minor", workspace: true }));

  const config = await loadConfig(root);
  expect(config.target).toBe("minor");
  expect(config.workspace).toBe(true);
});

test("loadConfig validates MCP and webhook config", async () => {
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-config-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
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
  const root = await (async () => { const d = path.join(os.tmpdir(), "rainy-updates-config-" + crypto.randomUUID()); await $`mkdir -p ${d}`; return d; })();
  await (async (p, c) => await Bun.write(p, c))(
    path.join(root, ".rainyupdatesrc"),
    JSON.stringify({ webhooks: [{ event: "not-real", url: "bad-url" }] }),
    "utf8",
  );

  await expect(loadConfig(root)).rejects.toThrow("Invalid config");
});

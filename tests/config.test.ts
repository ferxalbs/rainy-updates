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

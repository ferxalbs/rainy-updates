import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initCiWorkflow } from "../src/core/init-ci.js";

test("initCiWorkflow creates workflow file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-"));
  const result = await initCiWorkflow(dir, false);
  expect(result.created).toBe(true);

  const content = await readFile(result.path, "utf8");
  expect(content.includes("Rainy Updates")).toBe(true);
});

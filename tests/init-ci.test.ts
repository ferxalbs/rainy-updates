import { expect, test } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initCiWorkflow } from "../src/core/init-ci.js";

test("initCiWorkflow creates strict workflow file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-"));
  const result = await initCiWorkflow(dir, false, { mode: "strict", schedule: "weekly" });
  expect(result.created).toBe(true);

  const content = await readFile(result.path, "utf8");
  expect(content.includes("Rainy Updates")).toBe(true);
  expect(content.includes("Warm cache")).toBe(true);
  expect(content.includes("Upload SARIF")).toBe(true);
});

test("initCiWorkflow uses pnpm install when pnpm lockfile exists", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-pnpm-"));
  await writeFile(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");

  const result = await initCiWorkflow(dir, true, { mode: "minimal", schedule: "off" });
  const content = await readFile(result.path, "utf8");
  expect(content.includes("pnpm install --frozen-lockfile")).toBe(true);
  expect(content.includes("workflow_dispatch")).toBe(true);
});

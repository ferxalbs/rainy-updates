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
  expect(content.includes("@rainy-updates/cli ci")).toBe(true);
  expect(content.includes("--mode strict")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--plan-file .artifacts/decision-plan.json")).toBe(true);
});

test("initCiWorkflow uses pnpm install when pnpm lockfile exists", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-pnpm-"));
  await writeFile(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n", "utf8");

  const result = await initCiWorkflow(dir, true, { mode: "minimal", schedule: "off" });
  const content = await readFile(result.path, "utf8");
  expect(content.includes("pnpm install --frozen-lockfile")).toBe(true);
  expect(content.includes("workflow_dispatch")).toBe(true);
});

test("initCiWorkflow creates enterprise workflow matrix", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "rainy-init-ci-enterprise-"));
  const result = await initCiWorkflow(dir, true, { mode: "enterprise", schedule: "weekly" });
  const content = await readFile(result.path, "utf8");

  expect(content.includes("Rainy Updates Enterprise")).toBe(true);
  expect(content.includes("matrix")).toBe(true);
  expect(content.includes("retention-days: 14")).toBe(true);
  expect(content.includes("--fail-on minor")).toBe(true);
  expect(content.includes("--max-updates 50")).toBe(true);
  expect(content.includes("--mode enterprise")).toBe(true);
  expect(content.includes("--gate review")).toBe(true);
  expect(content.includes("--gate upgrade")).toBe(true);
  expect(content.includes("--from-plan .artifacts/decision-plan.json")).toBe(true);
  expect(content.includes("--verification-report-file .artifacts/verification-node-${{ matrix.node }}.json")).toBe(true);
});
